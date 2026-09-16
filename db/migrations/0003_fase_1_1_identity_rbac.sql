-- Migración DDL Incremental — Política Canon v0.3.12 (Fase 1.1)
-- Identidad, Invitaciones, Usuarios, Sesiones y RBAC/ABAC
-- Motorización: PostgreSQL 16+
-- Ejecutante obligatorio: app_owner (SET ROLE app_owner)

-- 1. INVITACIONES: Permitir invitaciones de ámbito organizacional (workspace_id opcional) y cualquier rol válido
ALTER TABLE invitations ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS check_invitation_role;

-- 2. USUARIOS: Estado MFA, intentos fallidos y bloqueo por seguridad
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- 3. SESIONES: Registro de verificación MFA reciente para step-up (frescura <= 15 min)
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ;

-- 4. POLÍTICAS RLS ADAPTADAS PARA SESIONES E INVITACIONES (Permite resolución basal por token_hash / sid_hash)
DROP POLICY IF EXISTS tenant_isolation_policy ON user_sessions;
CREATE POLICY user_sessions_tenant_policy ON user_sessions FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID OR NULLIF(current_setting('app.current_organization_id', true), '') IS NULL)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

DROP POLICY IF EXISTS tenant_isolation_policy ON invitations;
CREATE POLICY invitations_tenant_policy ON invitations FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID OR NULLIF(current_setting('app.current_organization_id', true), '') IS NULL)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

-- 5. ÍNDICES DE ALTO RENDIMIENTO PARA CONSULTAS DE SEGURIDAD
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_org_email ON invitations(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_sid_hash ON user_sessions(sid_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_role_assignments_lookup ON role_assignments(organization_id, target_user_id, scope_type, scope_id) WHERE is_active = TRUE;
