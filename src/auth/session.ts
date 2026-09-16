import { PoolClient } from 'pg';
import { generateHighEntropyToken, hashToken } from './crypto.js';

export interface UserSession {
  id: string;
  organizationId: string;
  userId: string;
  sidHash: string;
  antiCsrfTokenHash: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  revokedAt?: string | null;
  mfaVerifiedAt?: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: string;
}

const MAX_ACTIVE_SESSIONS_PER_USER = 5;
const IDLE_TIMEOUT_MINUTES = 30;
const ABSOLUTE_TIMEOUT_HOURS = 24;

/**
 * Crea una nueva sesión persistida en PostgreSQL y gestiona el límite de sesiones activas por usuario
 */
export async function createSession(
  client: PoolClient,
  params: {
    userId: string;
    organizationId: string;
    ipAddress: string;
    userAgent: string;
    mfaVerified?: boolean;
  }
): Promise<{ session: UserSession; rawToken: string; rawCsrfToken: string }> {
  const { userId, organizationId, ipAddress, userAgent, mfaVerified } = params;

  // Límite de sesiones activas: si excede el máximo, revocar la sesión inactiva más antigua
  const activeSessions = await client.query(
    `SELECT id FROM user_sessions 
     WHERE user_id = $1 AND revoked_at IS NULL AND absolute_expires_at > NOW()
     ORDER BY created_at ASC`,
    [userId]
  );

  if (activeSessions.rows.length >= MAX_ACTIVE_SESSIONS_PER_USER) {
    const toRevokeCount = activeSessions.rows.length - MAX_ACTIVE_SESSIONS_PER_USER + 1;
    for (let i = 0; i < toRevokeCount; i++) {
      await client.query(
        `UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1`,
        [activeSessions.rows[i].id]
      );
    }
  }

  const rawToken = generateHighEntropyToken(32);
  const sidHash = hashToken(rawToken);

  const rawCsrfToken = generateHighEntropyToken(32);
  const antiCsrfTokenHash = hashToken(rawCsrfToken);

  const now = new Date();
  const idleExpiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MINUTES * 60 * 1000);
  const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000);
  const mfaVerifiedAt = mfaVerified ? now.toISOString() : null;

  await client.query("SELECT set_config('app.current_organization_id', $1, false)", [organizationId]);

  const res = await client.query(
    `INSERT INTO user_sessions (
      organization_id, user_id, sid_hash, anti_csrf_token_hash,
      ip_address, user_agent, idle_expires_at, absolute_expires_at, mfa_verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, organization_id, user_id, sid_hash, anti_csrf_token_hash, ip_address, user_agent, created_at, idle_expires_at, absolute_expires_at, revoked_at, mfa_verified_at`,
    [
      organizationId,
      userId,
      sidHash,
      antiCsrfTokenHash,
      ipAddress,
      userAgent,
      idleExpiresAt.toISOString(),
      absoluteExpiresAt.toISOString(),
      mfaVerifiedAt,
    ]
  );

  const row = res.rows[0];
  const session: UserSession = {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    sidHash: row.sid_hash,
    antiCsrfTokenHash: row.anti_csrf_token_hash,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    idleExpiresAt: row.idle_expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
    revokedAt: row.revoked_at,
    mfaVerifiedAt: row.mfa_verified_at,
  };

  return { session, rawToken, rawCsrfToken };
}

/**
 * Valida la sesión activa a través de su token en texto claro y extiende el tiempo de inactividad
 */
export async function validateSession(
  client: PoolClient,
  rawToken: string
): Promise<{ session: UserSession | null; user: UserProfile | null }> {
  if (!rawToken) return { session: null, user: null };

  const sidHash = hashToken(rawToken);

  const res = await client.query(
    `SELECT s.*, u.email, u.full_name, u.is_active AS user_active, u.mfa_enabled, u.created_at AS user_created_at, u.locked_until
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.sid_hash = $1 AND s.revoked_at IS NULL AND s.idle_expires_at > NOW() AND s.absolute_expires_at > NOW()`,
    [sidHash]
  );

  if (res.rows.length === 0) {
    return { session: null, user: null };
  }

  const row = res.rows[0];

  // Comprobar bloqueo o inactividad del usuario
  if (!row.user_active) return { session: null, user: null };
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return { session: null, user: null };
  }

  // Renovar vencimiento por inactividad (idle timeout)
  const now = new Date();
  const newIdle = new Date(now.getTime() + IDLE_TIMEOUT_MINUTES * 60 * 1000);
  const absExpires = new Date(row.absolute_expires_at);
  const finalIdle = newIdle < absExpires ? newIdle : absExpires;

  await client.query(
    `UPDATE user_sessions SET idle_expires_at = $1 WHERE id = $2`,
    [finalIdle.toISOString(), row.id]
  );

  const session: UserSession = {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    sidHash: row.sid_hash,
    antiCsrfTokenHash: row.anti_csrf_token_hash,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    idleExpiresAt: finalIdle.toISOString(),
    absoluteExpiresAt: row.absolute_expires_at,
    revokedAt: row.revoked_at,
    mfaVerifiedAt: row.mfa_verified_at,
  };

  const user: UserProfile = {
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    isActive: row.user_active,
    mfaEnabled: row.mfa_enabled,
    createdAt: row.user_created_at,
  };

  return { session, user };
}

/**
 * Rotación del identificador de sesión al autenticar o elevar privilegios
 */
export async function rotateSession(
  client: PoolClient,
  oldRawToken: string,
  ipAddress: string,
  userAgent: string,
  mfaVerified?: boolean
): Promise<{ session: UserSession; rawToken: string; rawCsrfToken: string } | null> {
  const { session, user } = await validateSession(client, oldRawToken);
  if (!session || !user) return null;

  // Revocar la sesión anterior
  await client.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1`, [session.id]);

  // Crear la nueva sesión rotada
  return createSession(client, {
    userId: session.userId,
    organizationId: session.organizationId,
    ipAddress,
    userAgent,
    mfaVerified: mfaVerified ?? (session.mfaVerifiedAt !== null && session.mfaVerifiedAt !== undefined),
  });
}

/**
 * Revoca una sesión específica por su token
 */
export async function revokeSession(client: PoolClient, rawToken: string): Promise<boolean> {
  if (!rawToken) return false;
  const sidHash = hashToken(rawToken);
  const res = await client.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE sid_hash = $1 AND revoked_at IS NULL`, [sidHash]);
  return (res.rowCount ?? 0) > 0;
}

/**
 * Revoca todas las sesiones activas de un usuario (e.g. tras cambiar contraseña o restablecimiento)
 */
export async function revokeAllUserSessions(client: PoolClient, userId: string): Promise<number> {
  const res = await client.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
  return res.rowCount ?? 0;
}

/**
 * Actualiza la marca de tiempo de verificación MFA reciente en la sesión activa
 */
export async function updateSessionMfaVerified(client: PoolClient, sessionId: string): Promise<void> {
  await client.query(`UPDATE user_sessions SET mfa_verified_at = NOW() WHERE id = $1`, [sessionId]);
}
