-- Migración DDL Rollback — Política Canon v0.3.12 (Fase 1.1)
-- Reversión de índices y columnas agregadas en 0003

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
