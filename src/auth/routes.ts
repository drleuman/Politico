import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { dbPool } from '../db/client.js';
import { redisClient } from '../redis/client.js';
import { config } from '../config/env.js';
import { sendInvitationEmail } from '../email/adapter.js';
import {
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
  generateHighEntropyToken,
  hashToken,
  timingSafeEqualString,
} from './crypto.js';
import {
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  getUserActiveSessions,
  revokeSpecificSession,
} from './session.js';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  acceptInvitation,
} from './invitations.js';
import {
  setupMfa,
  confirmMfa,
  verifyMfaStepUp,
  disableMfa,
} from './mfa.js';
import { buildResolvedAuthorizationContext } from './roles.js';
import { recordSecurityAuditEvent } from '../audit/events.js';

const MASTER_KEY = config.mfaMasterKey;

/**
 * Control de tasa (Rate Limiting) con Redis — FAIL CLOSED
 */
async function checkRateLimit(key: string, maxAttempts: number, windowSeconds: number): Promise<boolean> {
  if (!redisClient) return false;

  try {
    if (redisClient.status !== 'ready' && redisClient.status !== 'connecting') {
      await redisClient.connect();
    }
    const attempts = await redisClient.incr(key);
    if (attempts === 1) {
      await redisClient.expire(key, windowSeconds);
    }
    return attempts <= maxAttempts;
  } catch {
    return false; // FAIL CLOSED
  }
}

/**
 * Extrae el token de sesión exclusivamente desde la cookie HttpOnly 'sid'
 */
function extractSessionToken(request: FastifyRequest): string | null {
  const cookies = request.cookies || {};
  return cookies.sid || null;
}

/**
 * Valida la cabecera Anti-CSRF para peticiones mutativas (POST, PUT, DELETE, PATCH)
 */
function verifyCsrfToken(request: FastifyRequest, sessionAntiCsrfHash: string): boolean {
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

  const csrfHeader = (request.headers['x-csrf-token'] as string) || '';
  if (!csrfHeader) return false;

  const headerHash = hashToken(csrfHeader);
  return timingSafeEqualString(headerHash, sessionAntiCsrfHash);
}

export async function registerAuthRoutes(fastify: FastifyInstance) {
  const pool = dbPool;

  // --------------------------------------------------------------------------
  // 1. ENDPOINTS DE INVITACIONES
  // --------------------------------------------------------------------------

  // POST /api/v1/invitations — Crear invitación privada (Exige RBAC, MFA, Anti-CSRF y Email Transport Fail-Closed)
  fastify.post('/api/v1/invitations', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Sesión no válida o expirada.' });
      }

      if (!verifyCsrfToken(request, session.antiCsrfTokenHash)) {
        return reply.status(403).send({ error: 'CSRF_INVALID: Token Anti-CSRF no válido o ausente.' });
      }

      const authContext = await buildResolvedAuthorizationContext(client, session.userId, session.organizationId, session.mfaVerifiedAt);
      const isGovernanceUser = authContext.roles.includes('ADMIN') || authContext.roles.includes('COORDINATOR');
      if (!isGovernanceUser) {
        return reply.status(403).send({ error: 'FORBIDDEN: Requiere rol ADMIN o COORDINATOR para emitir invitaciones.' });
      }

      if (!user.mfaEnabled || authContext.mfaAgeSeconds === undefined || authContext.mfaAgeSeconds > 900) {
        return reply.status(403).send({ error: 'MFA_REQUIRED: Requiere MFA habilitado y verificación reciente (<15 min) para gestionar invitaciones.' });
      }

      const body = request.body as any || {};
      const { email, role, workspaceId, expiresInHours } = body;

      if (!email || !role) {
        return reply.status(400).send({ error: 'MISSING_FIELDS: email y role son obligatorios.' });
      }

      if (['APPROVER', 'PUBLISHER', 'AUDITOR'].includes(role)) {
        return reply.status(403).send({ error: 'FORBIDDEN_GOVERNANCE_ROLE: No se permite invitar directamente roles privilegiados de gobernanza.' });
      }

      const result = await createInvitation(client, {
        organizationId: session.organizationId,
        workspaceId,
        email,
        role,
        invitedBy: session.userId,
        expiresInHours,
      });

      const invitationUrl = `${config.appBaseUrl}/accept-invitation?token=${result.rawToken}`;

      try {
        await sendInvitationEmail({
          toEmail: email.trim().toLowerCase(),
          rawToken: result.rawToken,
          invitationUrl,
        });
      } catch (emailErr: any) {
        // En caso de fallo en el transporte de email, rollback de la invitación almacenada (FAIL-CLOSED)
        await client.query('DELETE FROM invitations WHERE id = $1', [result.invitationId]);
        return reply.status(503).send({ error: emailErr.message });
      }

      // Respuesta segura: NUNCA expone el rawToken ni la URL con token en el cuerpo JSON
      return reply.status(201).send({
        status: 'created',
        invitationId: result.invitationId,
        expiresAt: result.expiresAt,
        message: 'Invitación enviada exitosamente por correo electrónico.',
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    } finally {
      client.release();
    }
  });

  // GET /api/v1/invitations — Listar invitaciones activas de la organización
  fastify.get('/api/v1/invitations', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      const authContext = await buildResolvedAuthorizationContext(client, session.userId, session.organizationId, session.mfaVerifiedAt);
      const isGovernanceUser = authContext.roles.includes('ADMIN') || authContext.roles.includes('COORDINATOR');
      if (!isGovernanceUser) {
        return reply.status(403).send({ error: 'FORBIDDEN: Requiere rol ADMIN o COORDINATOR para consultar invitaciones.' });
      }

      if (!user.mfaEnabled || authContext.mfaAgeSeconds === undefined || authContext.mfaAgeSeconds > 900) {
        return reply.status(403).send({ error: 'MFA_REQUIRED: Requiere MFA habilitado y verificación reciente (<15 min) para gestionar invitaciones.' });
      }

      const list = await listInvitations(client, session.organizationId);
      return reply.status(200).send({ invitations: list });
    } finally {
      client.release();
    }
  });

  // DELETE /api/v1/invitations/:id — Revocar invitación
  fastify.delete('/api/v1/invitations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const { id } = request.params as any;
    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      if (!verifyCsrfToken(request, session.antiCsrfTokenHash)) {
        return reply.status(403).send({ error: 'CSRF_INVALID: Token Anti-CSRF no válido o ausente.' });
      }

      const authContext = await buildResolvedAuthorizationContext(client, session.userId, session.organizationId, session.mfaVerifiedAt);
      const isGovernanceUser = authContext.roles.includes('ADMIN') || authContext.roles.includes('COORDINATOR');
      if (!isGovernanceUser) {
        return reply.status(403).send({ error: 'FORBIDDEN: Requiere rol ADMIN o COORDINATOR para revocar invitaciones.' });
      }

      if (!user.mfaEnabled || authContext.mfaAgeSeconds === undefined || authContext.mfaAgeSeconds > 900) {
        return reply.status(403).send({ error: 'MFA_REQUIRED: Requiere MFA habilitado y verificación reciente (<15 min) para gestionar invitaciones.' });
      }

      const revoked = await revokeInvitation(client, {
        invitationId: id,
        organizationId: session.organizationId,
        revokedBy: session.userId,
      });

      if (!revoked) {
        return reply.status(404).send({ error: 'INVITATION_NOT_FOUND: Invitación no encontrada o consumida.' });
      }

      return reply.status(200).send({ status: 'revoked' });
    } finally {
      client.release();
    }
  });

  // POST /api/v1/invitations/accept — Aceptar invitación privada y registrar usuario
  fastify.post('/api/v1/invitations/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any || {};
    const { token, fullName, password } = body;

    if (!token || !fullName || !password) {
      return reply.status(400).send({ error: 'MISSING_FIELDS: token, fullName y password son obligatorios.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const newUser = await acceptInvitation(client, { rawToken: token, fullName, password });
      await client.query('COMMIT');

      return reply.status(201).send({
        status: 'user_created',
        userId: newUser.userId,
        email: newUser.email,
        organizationId: newUser.organizationId,
        role: newUser.role,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: err.message });
    } finally {
      client.release();
    }
  });

  // --------------------------------------------------------------------------
  // 2. ENDPOINTS DE AUTENTICACIÓN Y SESIÓN
  // --------------------------------------------------------------------------

  // POST /api/v1/auth/login — Inicio de sesión con credenciales Argon2id
  fastify.post('/api/v1/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip || '127.0.0.1';
    const userAgent = request.headers['user-agent'] || 'Unknown';
    const body = request.body as any || {};
    const { email, password, organizationId } = body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'MISSING_FIELDS: email y password son requeridos.' });
    }

    // Rate Limiting Fail-Closed
    const rateOk = await checkRateLimit(`rate:login:${ip}:${email.toLowerCase()}`, 5, 900);
    if (!rateOk) {
      return reply.status(503).send({ error: 'RATE_LIMIT_UNAVAILABLE_OR_EXCEEDED: Control de tasa no disponible o demasiados intentos fallidos.' });
    }

    const client = await pool.connect();
    try {
      const userRes = await client.query(
        `SELECT u.id, u.email, u.full_name, u.is_active, u.mfa_enabled, u.failed_login_attempts, u.locked_until, uc.password_hash
         FROM users u
         JOIN user_credentials uc ON uc.user_id = u.id
         WHERE u.email = $1`,
        [email.trim().toLowerCase()]
      );

      if (userRes.rows.length === 0) {
        return reply.status(401).send({ error: 'INVALID_CREDENTIALS: Credenciales inválidas.' });
      }

      const user = userRes.rows[0];

      if (!user.is_active) {
        return reply.status(403).send({ error: 'USER_INACTIVE: La cuenta se encuentra desactivada.' });
      }

      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return reply.status(403).send({ error: 'ACCOUNT_LOCKED: Cuenta bloqueada temporalmente por seguridad.' });
      }

      const isMatch = await verifyPassword(user.password_hash, password);
      if (!isMatch) {
        const attempts = (user.failed_login_attempts || 0) + 1;
        let lockUntilSql = null;
        if (attempts >= 5) {
          lockUntilSql = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }
        await client.query(
          `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
          [attempts, lockUntilSql, user.id]
        );

        const orgForAudit = organizationId || (await client.query(`SELECT organization_id FROM organization_memberships WHERE user_id = $1 LIMIT 1`, [user.id])).rows[0]?.organization_id;
        if (orgForAudit) {
          await recordSecurityAuditEvent(client, {
            organizationId: orgForAudit,
            actorId: user.id,
            eventType: 'LOGIN_FAILED',
            payload: { ipAddress: ip },
          });
        }

        return reply.status(401).send({ error: 'INVALID_CREDENTIALS: Credenciales inválidas.' });
      }

      // Reiniciar intentos fallidos
      await client.query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [user.id]);

      // Validar membresía activa y vigente en la organización solicitada
      let targetOrgId = organizationId;
      if (targetOrgId) {
        await client.query(`SELECT set_config('app.current_organization_id', $1, false);`, [targetOrgId]);
        const memRes = await client.query<{ organization_id: string }>(
          `SELECT organization_id FROM organization_memberships 
           WHERE user_id = $1 AND organization_id = $2 AND is_active = TRUE AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())`,
          [user.id, targetOrgId]
        );
        if (memRes.rows.length === 0) {
          return reply.status(403).send({ error: 'NO_ACTIVE_MEMBERSHIP: Membresía inactiva o no perteneciente a la organización especificada.' });
        }
      } else {
        const orgRes = await client.query<{ organization_id: string }>(
          `SELECT organization_id FROM organization_memberships 
           WHERE user_id = $1 AND is_active = TRUE AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW()) LIMIT 1`,
          [user.id]
        );
        if (orgRes.rows.length === 0) {
          return reply.status(403).send({ error: 'NO_ACTIVE_ORGANIZATION: El usuario no posee membresía activa.' });
        }
        targetOrgId = orgRes.rows[0].organization_id;
        await client.query(`SELECT set_config('app.current_organization_id', $1, false);`, [targetOrgId]);
      }

      // Crear sesión persistida
      const { session, rawToken, rawCsrfToken } = await createSession(client, {
        userId: user.id,
        organizationId: targetOrgId,
        ipAddress: ip,
        userAgent,
        mfaVerified: false,
      });

      await recordSecurityAuditEvent(client, {
        organizationId: targetOrgId,
        actorId: user.id,
        eventType: 'LOGIN_SUCCESS',
        payload: { sessionId: session.id, ipAddress: ip },
      });

      // Cookie de sesión HttpOnly exclusivamente (SIN token en JSON)
      reply.setCookie('sid', rawToken, {
        path: '/',
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
      });

      reply.setCookie('csrf', rawCsrfToken, {
        path: '/',
        httpOnly: false,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
      });

      return reply.status(200).send({
        status: 'authenticated',
        csrfToken: rawCsrfToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          mfaEnabled: user.mfa_enabled,
        },
        organizationId: targetOrgId,
      });
    } finally {
      client.release();
    }
  });

  // POST /api/v1/auth/logout — Cierre de la sesión actual
  fastify.post('/api/v1/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const client = await pool.connect();
    try {
      if (token) {
        const { session } = await validateSession(client, token);
        if (session) {
          if (!verifyCsrfToken(request, session.antiCsrfTokenHash)) {
            return reply.status(403).send({ error: 'CSRF_INVALID: Token Anti-CSRF no válido o ausente.' });
          }

          await revokeSession(client, token);
          await recordSecurityAuditEvent(client, {
            organizationId: session.organizationId,
            actorId: session.userId,
            eventType: 'LOGOUT',
            payload: { sessionId: session.id },
          });
        }
      }

      reply.clearCookie('sid', { path: '/' });
      return reply.status(200).send({ status: 'logged_out' });
    } finally {
      client.release();
    }
  });

  // POST /api/v1/auth/logout-all — Cierre de todas las sesiones del usuario
  fastify.post('/api/v1/auth/logout-all', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const client = await pool.connect();
    try {
      const { session } = await validateSession(client, token || '');
      if (!session) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      if (!verifyCsrfToken(request, session.antiCsrfTokenHash)) {
        return reply.status(403).send({ error: 'CSRF_INVALID: Token Anti-CSRF no válido o ausente.' });
      }

      const revokedCount = await revokeAllUserSessions(client, session.userId);
      await recordSecurityAuditEvent(client, {
        organizationId: session.organizationId,
        actorId: session.userId,
        eventType: 'LOGOUT_ALL',
        payload: { revokedCount },
      });

      reply.clearCookie('sid', { path: '/' });
      return reply.status(200).send({ status: 'all_sessions_revoked', count: revokedCount });
    } finally {
      client.release();
    }
  });

  // GET /api/v1/sessions — Listar sesiones activas del usuario
  fastify.get('/api/v1/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      const sessionsList = await getUserActiveSessions(client, user.id, session.id);
      return reply.status(200).send({ sessions: sessionsList });
    } finally {
      client.release();
    }
  });

  // DELETE /api/v1/sessions/:id — Revocar sesión específica del usuario
  fastify.delete('/api/v1/sessions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const { id } = request.params as any;
    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      if (!verifyCsrfToken(request, session.antiCsrfTokenHash)) {
        return reply.status(403).send({ error: 'CSRF_INVALID: Token Anti-CSRF no válido o ausente.' });
      }

      const revoked = await revokeSpecificSession(client, user.id, id);
      if (!revoked) {
        return reply.status(404).send({ error: 'SESSION_NOT_FOUND: Sesión no encontrada o ya revocada.' });
      }

      await recordSecurityAuditEvent(client, {
        organizationId: session.organizationId,
        actorId: user.id,
        eventType: 'SESSION_REVOKED',
        payload: { targetSessionId: id },
      });

      return reply.status(200).send({ status: 'session_revoked' });
    } finally {
      client.release();
    }
  });

  // GET /api/v1/users — Listar usuarios de la organización (ADMIN / COORDINATOR + MFA reciente)
  fastify.get('/api/v1/users', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      const authContext = await buildResolvedAuthorizationContext(client, session.userId, session.organizationId, session.mfaVerifiedAt);
      const isGovernanceUser = authContext.roles.includes('ADMIN') || authContext.roles.includes('COORDINATOR');
      if (!isGovernanceUser) {
        return reply.status(403).send({ error: 'FORBIDDEN: Requiere rol ADMIN o COORDINATOR para consultar la lista de usuarios.' });
      }

      if (!user.mfaEnabled || authContext.mfaAgeSeconds === undefined || authContext.mfaAgeSeconds > 900) {
        return reply.status(403).send({ error: 'MFA_REQUIRED: Requiere MFA habilitado y verificación reciente (<15 min) para gestionar usuarios.' });
      }

      await client.query("SELECT set_config('app.current_organization_id', $1, false)", [session.organizationId]);
      const usersRes = await client.query(
        `SELECT u.id, u.email, u.full_name, u.is_active, u.mfa_enabled, u.created_at
         FROM users u
         JOIN organization_memberships om ON om.user_id = u.id AND om.organization_id = $1
         ORDER BY u.created_at DESC`,
        [session.organizationId]
      );

      return reply.status(200).send({
        users: usersRes.rows.map(r => ({
          id: r.id,
          email: r.email,
          fullName: r.full_name,
          isActive: r.is_active,
          mfaEnabled: r.mfa_enabled,
          createdAt: new Date(r.created_at).toISOString(),
        }))
      });
    } finally {
      client.release();
    }
  });

  // PATCH /api/v1/users/:id/status — Activar/Desactivar cuenta de usuario (ADMIN / COORDINATOR + MFA reciente)
  fastify.patch('/api/v1/users/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const { id } = request.params as any;
    const body = request.body as any || {};
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return reply.status(400).send({ error: 'MISSING_FIELDS: el campo boolean isActive es obligatorio.' });
    }

    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      if (!verifyCsrfToken(request, session.antiCsrfTokenHash)) {
        return reply.status(403).send({ error: 'CSRF_INVALID: Token Anti-CSRF no válido o ausente.' });
      }

      const authContext = await buildResolvedAuthorizationContext(client, session.userId, session.organizationId, session.mfaVerifiedAt);
      const isGovernanceUser = authContext.roles.includes('ADMIN') || authContext.roles.includes('COORDINATOR');
      if (!isGovernanceUser) {
        return reply.status(403).send({ error: 'FORBIDDEN: Requiere rol ADMIN o COORDINATOR para actualizar el estado de cuenta.' });
      }

      if (!user.mfaEnabled || authContext.mfaAgeSeconds === undefined || authContext.mfaAgeSeconds > 900) {
        return reply.status(403).send({ error: 'MFA_REQUIRED: Requiere MFA habilitado y verificación reciente (<15 min) para gestionar usuarios.' });
      }

      await client.query("SELECT set_config('app.current_organization_id', $1, false)", [session.organizationId]);
      const updateRes = await client.query(
        `UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, email, is_active`,
        [isActive, id]
      );

      if (updateRes.rows.length === 0) {
        return reply.status(404).send({ error: 'USER_NOT_FOUND: Usuario no encontrado.' });
      }

      if (!isActive) {
        await revokeAllUserSessions(client, id);
      }

      await recordSecurityAuditEvent(client, {
        organizationId: session.organizationId,
        actorId: session.userId,
        eventType: 'USER_STATUS_UPDATED',
        payload: { targetUserId: id, isActive },
      });

      return reply.status(200).send({ status: 'updated', user: updateRes.rows[0] });
    } finally {
      client.release();
    }
  });

  // POST /api/v1/auth/forgot-password — Solicitud de restablecimiento (SIN fuga de resetToken en JSON)
  fastify.post('/api/v1/auth/forgot-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip || '127.0.0.1';
    const body = request.body as any || {};
    const { email } = body;

    if (!email) {
      return reply.status(400).send({ error: 'MISSING_EMAIL: El correo electrónico es requerido.' });
    }

    const rateOk = await checkRateLimit(`rate:forgot:${ip}:${email.toLowerCase()}`, 3, 900);
    if (!rateOk) {
      return reply.status(530).send({ error: 'RATE_LIMIT_UNAVAILABLE_OR_EXCEEDED: Solicitudes de restablecimiento no disponibles o excedidas.' });
    }

    const client = await pool.connect();
    try {
      const userRes = await client.query(`SELECT id FROM users WHERE email = $1 AND is_active = TRUE`, [email.trim().toLowerCase()]);
      if (userRes.rows.length > 0) {
        const userId = userRes.rows[0].id;
        const rawToken = generateHighEntropyToken(32);
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        await client.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
          [userId, tokenHash, expiresAt]
        );

        const orgRes = await client.query(`SELECT organization_id FROM organization_memberships WHERE user_id = $1 LIMIT 1`, [userId]);
        if (orgRes.rows.length > 0) {
          await recordSecurityAuditEvent(client, {
            organizationId: orgRes.rows[0].organization_id,
            actorId: userId,
            eventType: 'PASSWORD_RESET_REQUESTED',
            payload: { userId },
          });
        }
      }

      // Respuesta genérica segura (SIN resetToken en JSON)
      return reply.status(200).send({
        status: 'reset_requested',
        message: 'Si la cuenta existe, se enviará el enlace de recuperación.',
      });
    } finally {
      client.release();
    }
  });

  // POST /api/v1/auth/reset-password — Ejecutar restablecimiento con token
  fastify.post('/api/v1/auth/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any || {};
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return reply.status(400).send({ error: 'MISSING_FIELDS: token y newPassword son requeridos.' });
    }

    const polCheck = validatePasswordPolicy(newPassword);
    if (!polCheck.valid) {
      return reply.status(400).send({ error: polCheck.reason });
    }

    const client = await pool.connect();
    try {
      const tokenHash = hashToken(token);
      const resetRes = await client.query(
        `SELECT id, user_id, expires_at, consumed_at FROM password_reset_tokens WHERE token_hash = $1`,
        [tokenHash]
      );

      if (resetRes.rows.length === 0 || resetRes.rows[0].consumed_at || new Date(resetRes.rows[0].expires_at) <= new Date()) {
        return reply.status(400).send({ error: 'TOKEN_INVALID: Token de recuperación inválido, consumido o expirado.' });
      }

      const { id: resetId, user_id: userId } = resetRes.rows[0];
      const newHash = await hashPassword(newPassword);

      await client.query(`UPDATE user_credentials SET password_hash = $1, updated_at = NOW() WHERE user_id = $2`, [newHash, userId]);
      await client.query(`UPDATE password_reset_tokens SET consumed_at = NOW() WHERE id = $1`, [resetId]);
      await revokeAllUserSessions(client, userId);

      const orgRes = await client.query(`SELECT organization_id FROM organization_memberships WHERE user_id = $1 LIMIT 1`, [userId]);
      if (orgRes.rows.length > 0) {
        await recordSecurityAuditEvent(client, {
          organizationId: orgRes.rows[0].organization_id,
          actorId: userId,
          eventType: 'PASSWORD_RESET_COMPLETED',
          payload: { userId },
        });
      }

      return reply.status(200).send({ status: 'password_reset_successful' });
    } finally {
      client.release();
    }
  });

  // POST /api/v1/auth/change-password — Cambio de contraseña autenticado
  fastify.post('/api/v1/auth/change-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const body = request.body as any || {};
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return reply.status(400).send({ error: 'MISSING_FIELDS: currentPassword y newPassword son requeridos.' });
    }

    const polCheck = validatePasswordPolicy(newPassword);
    if (!polCheck.valid) {
      return reply.status(400).send({ error: polCheck.reason });
    }

    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      if (!verifyCsrfToken(request, session.antiCsrfTokenHash)) {
        return reply.status(403).send({ error: 'CSRF_INVALID: Token Anti-CSRF no válido o ausente.' });
      }

      const credRes = await client.query(`SELECT password_hash FROM user_credentials WHERE user_id = $1`, [user.id]);
      if (credRes.rows.length === 0 || !(await verifyPassword(credRes.rows[0].password_hash, currentPassword))) {
        return reply.status(401).send({ error: 'PASSWORD_INCORRECT: Contraseña actual incorrecta.' });
      }

      const newHash = await hashPassword(newPassword);
      await client.query(`UPDATE user_credentials SET password_hash = $1, updated_at = NOW() WHERE user_id = $2`, [newHash, user.id]);

      await client.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL`, [user.id, session.id]);

      await recordSecurityAuditEvent(client, {
        organizationId: session.organizationId,
        actorId: user.id,
        eventType: 'PASSWORD_CHANGED',
        payload: { userId: user.id },
      });

      return reply.status(200).send({ status: 'password_changed' });
    } finally {
      client.release();
    }
  });

  // --------------------------------------------------------------------------
  // 3. ENDPOINTS TOTP MFA
  // --------------------------------------------------------------------------

  // POST /api/v1/auth/mfa/setup — Configuración inicial TOTP
  fastify.post('/api/v1/auth/mfa/setup', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      if (!verifyCsrfToken(request, session.antiCsrfTokenHash)) {
        return reply.status(403).send({ error: 'CSRF_INVALID: Token Anti-CSRF no válido o ausente.' });
      }

      const setupResult = await setupMfa(client, {
        userId: user.id,
        organizationId: session.organizationId,
        userEmail: user.email,
        masterKey: MASTER_KEY,
      });

      return reply.status(200).send(setupResult);
    } finally {
      client.release();
    }
  });

  // POST /api/v1/auth/mfa/confirm — Confirmar enrolamiento con primer código TOTP
  fastify.post('/api/v1/auth/mfa/confirm', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const body = request.body as any || {};
    const { code } = body;

    if (!code) {
      return reply.status(400).send({ error: 'MISSING_CODE: El código TOTP es obligatorio.' });
    }

    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      if (!verifyCsrfToken(request, session.antiCsrfTokenHash)) {
        return reply.status(403).send({ error: 'CSRF_INVALID: Token Anti-CSRF no válido o ausente.' });
      }

      const result = await confirmMfa(client, {
        userId: user.id,
        organizationId: session.organizationId,
        sessionId: session.id,
        code,
        masterKey: MASTER_KEY,
      });

      return reply.status(200).send({ status: 'mfa_enabled', backupCodes: result.backupCodes });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    } finally {
      client.release();
    }
  });

  // POST /api/v1/auth/mfa/verify — Verificación Step-up para refrescar mfa_verified_at
  fastify.post('/api/v1/auth/mfa/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const body = request.body as any || {};
    const { code } = body;

    if (!code) {
      return reply.status(400).send({ error: 'MISSING_CODE: El código TOTP o de respaldo es obligatorio.' });
    }

    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      if (!verifyCsrfToken(request, session.antiCsrfTokenHash)) {
        return reply.status(403).send({ error: 'CSRF_INVALID: Token Anti-CSRF no válido o ausente.' });
      }

      const res = await verifyMfaStepUp(client, {
        userId: user.id,
        organizationId: session.organizationId,
        sessionId: session.id,
        code,
        masterKey: MASTER_KEY,
      });

      return reply.status(200).send({ status: 'mfa_verified', usedBackupCode: res.usedBackupCode });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    } finally {
      client.release();
    }
  });

  // POST /api/v1/auth/mfa/disable — Desactivar TOTP MFA
  fastify.post('/api/v1/auth/mfa/disable', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const body = request.body as any || {};
    const { password, code } = body;

    if (!password || !code) {
      return reply.status(400).send({ error: 'MISSING_FIELDS: password y code son obligatorios.' });
    }

    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      if (!verifyCsrfToken(request, session.antiCsrfTokenHash)) {
        return reply.status(403).send({ error: 'CSRF_INVALID: Token Anti-CSRF no válido o ausente.' });
      }

      await disableMfa(client, {
        userId: user.id,
        organizationId: session.organizationId,
        password,
        code,
        masterKey: MASTER_KEY,
      });

      return reply.status(200).send({ status: 'mfa_disabled' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    } finally {
      client.release();
    }
  });

  // GET /api/v1/auth/me — Información del usuario y contexto resuelto
  fastify.get('/api/v1/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractSessionToken(request);
    const client = await pool.connect();
    try {
      const { session, user } = await validateSession(client, token || '');
      if (!session || !user) {
        return reply.status(401).send({ error: 'UNAUTHENTICATED: Requiere sesión activa.' });
      }

      const authContext = await buildResolvedAuthorizationContext(
        client,
        user.id,
        session.organizationId,
        session.mfaVerifiedAt
      );

      return reply.status(200).send({
        user,
        session: {
          id: session.id,
          organizationId: session.organizationId,
          createdAt: session.createdAt,
          idleExpiresAt: session.idleExpiresAt,
          absoluteExpiresAt: session.absoluteExpiresAt,
          mfaVerifiedAt: session.mfaVerifiedAt,
        },
        authContext,
      });
    } finally {
      client.release();
    }
  });
}
