import { PoolClient } from 'pg';
import {
  ResolvedAuthorizationContext,
  UserRole,
  ScopeType,
  EffectiveRoleAssignment,
} from './authorization.js';
import { recordSecurityAuditEvent } from '../audit/events.js';

/**
 * Resuelve el contexto de autorización completo de un usuario para una organización específica
 */
export async function buildResolvedAuthorizationContext(
  client: PoolClient,
  userId: string | null,
  organizationId: string | null,
  mfaVerifiedAt?: string | null
): Promise<ResolvedAuthorizationContext> {
  if (!userId || !organizationId) {
    return {
      userId: null,
      isAnonymous: true,
      activeOrganizationId: null,
      roles: [],
      organizationMemberships: [],
      workspaceMemberships: [],
      authorityMemberships: [],
      effectiveRoleAssignments: [],
    };
  }

  // 1. Membresías de Organización
  const orgMemsRes = await client.query(
    `SELECT organization_id, is_active, valid_from, valid_until
     FROM organization_memberships
     WHERE user_id = $1 AND organization_id = $2 
       AND is_active = TRUE 
       AND valid_from <= NOW() 
       AND (valid_until IS NULL OR valid_until > NOW())`,
    [userId, organizationId]
  );
  const organizationMemberships = orgMemsRes.rows.map(r => ({
    organizationId: r.organization_id,
    isActive: r.is_active,
    validFrom: r.valid_from ? new Date(r.valid_from).toISOString() : undefined,
    validUntil: r.valid_until ? new Date(r.valid_until).toISOString() : undefined,
  }));

  // 2. Membresías de Workspace
  const wsMemsRes = await client.query(
    `SELECT organization_id, workspace_id, role, is_active, valid_from, valid_until
     FROM workspace_memberships
     WHERE user_id = $1 AND organization_id = $2
       AND is_active = TRUE 
       AND valid_from <= NOW() 
       AND (valid_until IS NULL OR valid_until > NOW())`,
    [userId, organizationId]
  );
  const workspaceMemberships = wsMemsRes.rows.map(r => ({
    organizationId: r.organization_id,
    workspaceId: r.workspace_id,
    role: r.role as UserRole,
    isActive: r.is_active,
    validFrom: r.valid_from ? new Date(r.valid_from).toISOString() : undefined,
    validUntil: r.valid_until ? new Date(r.valid_until).toISOString() : undefined,
  }));

  // 3. Membresías de Órgano de Autoridad
  const authMemsRes = await client.query(
    `SELECT am.organization_id, am.authority_body_id, am.role, am.is_active, am.valid_until, ab.body_type
     FROM authority_memberships am
     JOIN authority_bodies ab ON ab.organization_id = am.organization_id AND ab.id = am.authority_body_id
     WHERE am.user_id = $1 AND am.organization_id = $2
       AND am.is_active = TRUE 
       AND am.valid_from <= NOW() 
       AND (am.valid_until IS NULL OR am.valid_until > NOW())`,
    [userId, organizationId]
  );
  const authorityMemberships = authMemsRes.rows.map(r => ({
    organizationId: r.organization_id,
    authorityBodyId: r.authority_body_id,
    role: r.role,
    bodyType: r.body_type,
    isActive: r.is_active,
    validUntil: r.valid_until ? new Date(r.valid_until).toISOString() : undefined,
  }));

  // 4. Asignaciones Efectivas de Rol (role_assignments)
  const roleAssignRes = await client.query(
    `SELECT id, organization_id, scope_type, scope_id, assigned_role, is_active, valid_from, valid_until
     FROM role_assignments
     WHERE target_user_id = $1 AND organization_id = $2
       AND is_active = TRUE 
       AND valid_from <= NOW() 
       AND (valid_until IS NULL OR valid_until > NOW())`,
    [userId, organizationId]
  );
  const effectiveRoleAssignments: EffectiveRoleAssignment[] = roleAssignRes.rows.map(r => ({
    id: r.id,
    organizationId: r.organization_id,
    scopeType: r.scope_type as ScopeType,
    scopeId: r.scope_id,
    assignedRole: r.assigned_role as UserRole,
    role: r.assigned_role as UserRole,
    isActive: r.is_active,
    validFrom: new Date(r.valid_from).toISOString(),
    validUntil: r.valid_until ? new Date(r.valid_until).toISOString() : undefined,
  }));

  // Roles consolidados acumulados
  const rolesSet = new Set<UserRole>();
  for (const wm of workspaceMemberships) {
    if (wm.isActive) rolesSet.add(wm.role);
  }
  for (const ra of effectiveRoleAssignments) {
    if (ra.isActive) rolesSet.add(ra.assignedRole);
  }

  let mfaAgeSeconds: number | undefined;
  if (mfaVerifiedAt) {
    const verifiedTs = new Date(mfaVerifiedAt).getTime();
    if (Number.isFinite(verifiedTs)) {
      mfaAgeSeconds = Math.max(0, (Date.now() - verifiedTs) / 1000);
    }
  }

  return {
    userId,
    isAnonymous: false,
    activeOrganizationId: organizationId,
    roles: Array.from(rolesSet),
    organizationMemberships,
    workspaceMemberships,
    authorityMemberships,
    effectiveRoleAssignments,
    mfaVerifiedAt: mfaVerifiedAt || undefined,
    mfaAgeSeconds,
  };
}

/**
 * Concede un rol en role_assignments y registra el evento de auditoría
 */
export async function assignRoleTransactional(
  client: PoolClient,
  params: {
    organizationId: string;
    scopeType: ScopeType;
    scopeId: string;
    targetUserId: string;
    assignedRole: UserRole;
    grantedBy: string;
  }
): Promise<string> {
  const { organizationId, scopeType, scopeId, targetUserId, assignedRole, grantedBy } = params;

  const res = await client.query(
    `INSERT INTO role_assignments (organization_id, scope_type, scope_id, target_user_id, assigned_role, granted_by, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     RETURNING id`,
    [organizationId, scopeType, scopeId, targetUserId, assignedRole, grantedBy]
  );

  const roleAssignmentId = res.rows[0].id;

  await recordSecurityAuditEvent(client, {
    organizationId,
    actorId: grantedBy,
    eventType: 'ROLE_ASSIGNED',
    payload: {
      roleAssignmentId,
      targetUserId,
      scopeType,
      scopeId,
      assignedRole,
    },
  });

  return roleAssignmentId;
}
