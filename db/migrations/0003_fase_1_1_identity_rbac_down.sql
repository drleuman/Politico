-- Migración DDL Rollback — Política Canon v0.3.13 (Fase 1.1 Correctiva)
-- Reversión de funciones SECURITY DEFINER, índices y columnas agregadas en 0003

DROP FUNCTION IF EXISTS resolve_invitation_by_token(CHAR(64));
DROP FUNCTION IF EXISTS resolve_session_by_token(CHAR(64));
DROP FUNCTION IF EXISTS get_user_active_memberships(UUID);

DROP INDEX IF EXISTS idx_role_assignments_lookup;
DROP INDEX IF EXISTS idx_password_reset_tokens_hash;
DROP INDEX IF EXISTS idx_user_sessions_user_active;
DROP INDEX IF EXISTS idx_user_sessions_sid_hash;
DROP INDEX IF EXISTS idx_invitations_org_email;
DROP INDEX IF EXISTS idx_invitations_token_hash;

ALTER TABLE user_sessions DROP COLUMN IF EXISTS mfa_verified_at;
ALTER TABLE users DROP COLUMN IF EXISTS locked_until;
ALTER TABLE users DROP COLUMN IF EXISTS failed_login_attempts;
ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled;

-- Re-aplicar restricción histórica de roles en invitaciones si corresponde
ALTER TABLE invitations ADD CONSTRAINT check_invitation_role CHECK (role NOT IN ('ADMIN', 'APPROVER', 'PUBLISHER', 'AUDITOR'));
