-- Migración DDL Incremental — Política Canon v0.3.13 (Fase 1.1 Correctiva)
-- Identidad, Invitaciones, Usuarios, Sesiones y RBAC/ABAC (Endurecimiento de Seguridad)
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

-- 4. POLÍTICAS RLS ESTRICTAS (SIN FALLBACK NULL — DENEGACIÓN POR DEFECTO SI FALTA GUC)
DROP POLICY IF EXISTS tenant_isolation_policy ON user_sessions;
DROP POLICY IF EXISTS user_sessions_tenant_policy ON user_sessions;
CREATE POLICY tenant_isolation_policy ON user_sessions FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

DROP POLICY IF EXISTS tenant_isolation_policy ON invitations;
DROP POLICY IF EXISTS invitations_tenant_policy ON invitations;
CREATE POLICY tenant_isolation_policy ON invitations FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

-- 5. FUNCIONES SECURITY DEFINER PARA RESOLUCIÓN INICIAL SEGURA POR TOKEN HASH
CREATE OR REPLACE FUNCTION resolve_session_by_token(p_sid_hash CHAR(64))
RETURNS TABLE (
  session_id UUID,
  organization_id UUID,
  user_id UUID,
  anti_csrf_token_hash CHAR(64),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ,
  idle_expires_at TIMESTAMPTZ,
  absolute_expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  mfa_verified_at TIMESTAMPTZ,
  email VARCHAR(255),
  full_name VARCHAR(255),
  is_active BOOLEAN,
  mfa_enabled BOOLEAN,
  user_created_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id AS session_id,
    s.organization_id,
    s.user_id,
    s.anti_csrf_token_hash,
    s.ip_address,
    s.user_agent,
    s.created_at,
    s.idle_expires_at,
    s.absolute_expires_at,
    s.revoked_at,
    s.mfa_verified_at,
    u.email,
    u.full_name,
    u.is_active,
    u.mfa_enabled,
    u.created_at AS user_created_at,
    u.locked_until
  FROM user_sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.sid_hash = p_sid_hash
    AND s.revoked_at IS NULL
    AND u.is_active = TRUE
    AND (u.locked_until IS NULL OR u.locked_until <= NOW())
    AND s.idle_expires_at > NOW()
    AND s.absolute_expires_at > NOW();
END;
$$;

CREATE OR REPLACE FUNCTION resolve_invitation_by_token(p_token_hash CHAR(64))
RETURNS TABLE (
  invitation_id UUID,
  organization_id UUID,
  workspace_id UUID,
  email VARCHAR(255),
  role user_role_enum,
  invited_by UUID,
  expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id AS invitation_id,
    i.organization_id,
    i.workspace_id,
    i.email,
    i.role,
    i.invited_by,
    i.expires_at,
    i.consumed_at,
    i.created_at
  FROM invitations i
  WHERE i.token_hash = p_token_hash;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_active_memberships(p_user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT om.organization_id, om.is_active
  FROM organization_memberships om
  WHERE om.user_id = p_user_id
    AND om.is_active = TRUE
    AND om.valid_from <= NOW()
    AND (om.valid_until IS NULL OR om.valid_until > NOW());
END;
$$;

ALTER FUNCTION resolve_session_by_token(CHAR(64)) OWNER TO token_resolver;
ALTER FUNCTION resolve_invitation_by_token(CHAR(64)) OWNER TO token_resolver;
ALTER FUNCTION get_user_active_memberships(UUID) OWNER TO token_resolver;

-- 6. ÍNDICES DE ALTO RENDIMIENTO PARA CONSULTAS DE SEGURIDAD
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_org_email ON invitations(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_sid_hash ON user_sessions(sid_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_role_assignments_lookup ON role_assignments(organization_id, target_user_id, scope_type, scope_id) WHERE is_active = TRUE;
