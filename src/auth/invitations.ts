import { PoolClient } from 'pg';
import { UserRole } from './authorization.js';
import { generateHighEntropyToken, hashToken, hashPassword, validatePasswordPolicy } from './crypto.js';
import { recordSecurityAuditEvent } from '../audit/events.js';

export interface Invitation {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  email: string;
  role: UserRole;
  tokenHash: string;
  invitedBy: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
}

/**
 * Crea una invitación privada de un solo uso vinculada a organización, workspace (opcional), rol y emisor
 */
export async function createInvitation(
  client: PoolClient,
  params: {
    organizationId: string;
    workspaceId?: string | null;
    email: string;
    role: UserRole;
    invitedBy: string;
    expiresInHours?: number;
  }
): Promise<{ invitationId: string; rawToken: string; expiresAt: string }> {
  const { organizationId, workspaceId = null, email, role, invitedBy, expiresInHours = 48 } = params;

  if (['APPROVER', 'PUBLISHER', 'AUDITOR'].includes(role)) {
    throw new Error('ROLE_RESTRICTED: No se permite invitar directamente a roles de gobernanza restringidos (APPROVER, PUBLISHER, AUDITOR). Utilice el flujo transaccional de solicitudes.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const rawToken = generateHighEntropyToken(32);
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  await client.query("SELECT set_config('app.current_organization_id', $1, true)", [organizationId]);

  const res = await client.query(
    `INSERT INTO invitations (organization_id, workspace_id, email, role, token_hash, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, expires_at`,
    [organizationId, workspaceId, normalizedEmail, role, tokenHash, invitedBy, expiresAt]
  );

  const invitationId = res.rows[0].id;

  await recordSecurityAuditEvent(client, {
    organizationId,
    actorId: invitedBy,
    eventType: 'INVITATION_CREATED',
    payload: {
      invitationId,
      workspaceId,
      email: normalizedEmail,
      role,
      expiresAt,
    },
  });

  return { invitationId, rawToken, expiresAt: res.rows[0].expires_at };
}

/**
 * Lista las invitaciones activas de una organización
 */
export async function listInvitations(client: PoolClient, organizationId: string): Promise<Omit<Invitation, 'tokenHash'>[]> {
  await client.query("SELECT set_config('app.current_organization_id', $1, true)", [organizationId]);

  const res = await client.query(
    `SELECT id, organization_id, workspace_id, email, role, invited_by, expires_at, consumed_at, created_at
     FROM invitations
     WHERE organization_id = $1 AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [organizationId]
  );

  return res.rows.map(r => ({
    id: r.id,
    organizationId: r.organization_id,
    workspaceId: r.workspace_id,
    email: r.email,
    role: r.role as UserRole,
    invitedBy: r.invited_by,
    expiresAt: r.expires_at,
    consumedAt: r.consumed_at,
    createdAt: r.created_at,
  }));
}

/**
 * Revoca una invitación existente
 */
export async function revokeInvitation(
  client: PoolClient,
  params: { invitationId: string; organizationId: string; revokedBy: string }
): Promise<boolean> {
  const { invitationId, organizationId, revokedBy } = params;

  await client.query("SELECT set_config('app.current_organization_id', $1, true)", [organizationId]);

  const res = await client.query(
    `UPDATE invitations
     SET consumed_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND consumed_at IS NULL
     RETURNING email, role`,
    [invitationId, organizationId]
  );

  if (res.rowCount === 0) return false;

  await recordSecurityAuditEvent(client, {
    organizationId,
    actorId: revokedBy,
    eventType: 'INVITATION_REVOKED',
    payload: {
      invitationId,
      email: res.rows[0].email,
      role: res.rows[0].role,
    },
  });

  return true;
}

/**
 * Acepta una invitación privada mediante token de un solo uso, registrando al nuevo usuario
 */
export async function acceptInvitation(
  client: PoolClient,
  params: {
    rawToken: string;
    fullName: string;
    password: string;
  }
): Promise<{ userId: string; email: string; organizationId: string; role: UserRole }> {
  const { rawToken, fullName, password } = params;

  if (!rawToken) {
    throw new Error('El token de invitación es obligatorio.');
  }

  const polCheck = validatePasswordPolicy(password);
  if (!polCheck.valid) {
    throw new Error(polCheck.reason || 'La contraseña no cumple la política de complejidad.');
  }

  const tokenHash = hashToken(rawToken);

  const invRes = await client.query(
    `SELECT * FROM resolve_invitation_by_token($1)`,
    [tokenHash]
  );

  if (invRes.rows.length === 0) {
    throw new Error('INVITATION_INVALID: La invitación no existe o el token es incorrecto.');
  }

  const inv = invRes.rows[0];

  // Configurar variable de sesión RLS app.current_organization_id
  await client.query("SELECT set_config('app.current_organization_id', $1, true)", [inv.organization_id]);

  if (inv.consumed_at) {
    throw new Error('INVITATION_REUSED: La invitación ya ha sido consumida previamente.');
  }

  if (new Date(inv.expires_at) <= new Date()) {
    throw new Error('INVITATION_EXPIRED: La invitación ha superado su tiempo de expiración.');
  }

  // Comprobar si ya existe un usuario con ese email
  const existingUserRes = await client.query(`SELECT id FROM users WHERE email = $1`, [inv.email]);
  if (existingUserRes.rows.length > 0) {
    throw new Error('USER_ALREADY_EXISTS: Ya existe un usuario registrado con este correo electrónico.');
  }

  // Crear usuario
  const userRes = await client.query(
    `INSERT INTO users (email, full_name, is_active, mfa_enabled)
     VALUES ($1, $2, TRUE, FALSE)
     RETURNING id`,
    [inv.email, fullName.trim()]
  );
  const userId = userRes.rows[0].id;

  // Credenciales con Argon2id
  const passHash = await hashPassword(password);
  await client.query(
    `INSERT INTO user_credentials (user_id, password_hash, password_algo)
     VALUES ($1, $2, 'argon2id')`,
    [userId, passHash]
  );

  // Membresía de Organización
  await client.query(
    `INSERT INTO organization_memberships (organization_id, user_id, is_active)
     VALUES ($1, $2, TRUE)`,
    [inv.organization_id, userId]
  );

  // Membresía de Workspace si aplica
  if (inv.workspace_id) {
    await client.query(
      `INSERT INTO workspace_memberships (organization_id, workspace_id, user_id, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [inv.organization_id, inv.workspace_id, userId, inv.role]
    );
  }

  // Role Assignment efectivo
  const scopeType = inv.workspace_id ? 'WORKSPACE' : 'ORGANIZATION';
  const scopeId = inv.workspace_id || inv.organization_id;

  await client.query(
    `INSERT INTO role_assignments (organization_id, scope_type, scope_id, target_user_id, assigned_role, granted_by, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
    [inv.organization_id, scopeType, scopeId, userId, inv.role, inv.invited_by]
  );

  // Marcar invitación como consumida
  await client.query(`UPDATE invitations SET consumed_at = NOW() WHERE id = $1`, [inv.invitation_id || inv.id]);

  // Auditoría
  await recordSecurityAuditEvent(client, {
    organizationId: inv.organization_id,
    actorId: userId,
    eventType: 'INVITATION_ACCEPTED',
    payload: {
      invitationId: inv.invitation_id || inv.id,
      email: inv.email,
      role: inv.role,
    },
  });

  await recordSecurityAuditEvent(client, {
    organizationId: inv.organization_id,
    actorId: userId,
    eventType: 'USER_REGISTERED',
    payload: {
      userId,
      email: inv.email,
      fullName: fullName.trim(),
    },
  });

  return {
    userId,
    email: inv.email,
    organizationId: inv.organization_id,
    role: inv.role as UserRole,
  };
}
