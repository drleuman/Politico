import { PoolClient } from 'pg';

export type SecurityEventType =
  | 'INVITATION_CREATED'
  | 'INVITATION_REVOKED'
  | 'INVITATION_ACCEPTED'
  | 'USER_REGISTERED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'LOGOUT_ALL'
  | 'SESSION_REVOKED'
  | 'USER_STATUS_UPDATED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'PASSWORD_CHANGED'
  | 'MFA_ENABLED'
  | 'MFA_VERIFIED'
  | 'MFA_DISABLED'
  | 'ROLE_ASSIGNED';

/**
 * Registra un evento de auditoría de seguridad atómicamente en la tabla audit_outbox dentro de la transacción activa.
 * Sanitiza obligatoriamente la información prohibiendo la inclusión de contraseñas, tokens o secretos en el payload.
 */
export async function recordSecurityAuditEvent(
  client: PoolClient,
  params: {
    organizationId: string;
    actorId: string;
    eventType: SecurityEventType;
    payload: Record<string, any>;
  }
): Promise<string> {
  const { organizationId, actorId, eventType, payload } = params;

  // Sanitización estricta de propiedades sensibles en el payload
  const sanitizedPayload = JSON.parse(JSON.stringify(payload));
  const sensitiveKeys = ['password', 'token', 'secret', 'mfa_secret', 'token_hash', 'password_hash', 'code'];
  
  function sanitize(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
  }
  sanitize(sanitizedPayload);

  // Configurar variable de sesión app.current_organization_id para satisfacer la política RLS (is_local = false para que persista en el cliente)
  await client.query("SELECT set_config('app.current_organization_id', $1, false)", [organizationId]);

  const res = await client.query(
    `INSERT INTO audit_outbox (organization_id, actor_id, event_type, payload, status)
     VALUES ($1, $2, $3, $4, 'PENDING')
     RETURNING id`,
    [organizationId, actorId, eventType, JSON.stringify(sanitizedPayload)]
  );

  return res.rows[0].id;
}
