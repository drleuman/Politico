-- ============================================================================
-- Migración DDL Incrementada Forward-Only — Política Canon v0.3.23
-- Fase 1.1 Funcional Remediada: Políticas RLS, Outbox Duradero de Correo, Revocación Transaccional e Índices
-- ============================================================================

-- 1. POLÍTICAS RLS DE AISLAMIENTO MULTITENANT EN TABLAS OPERATIVAS DE IDENTIDAD Y MEMBRESÍA
DROP POLICY IF EXISTS tenant_isolation_policy ON organization_memberships;
CREATE POLICY tenant_isolation_policy ON organization_memberships FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

DROP POLICY IF EXISTS tenant_isolation_policy ON workspace_memberships;
CREATE POLICY tenant_isolation_policy ON workspace_memberships FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

DROP POLICY IF EXISTS tenant_isolation_policy ON role_assignments;
CREATE POLICY tenant_isolation_policy ON role_assignments FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

DROP POLICY IF EXISTS tenant_isolation_policy ON mfa_backup_codes;
CREATE POLICY tenant_isolation_policy ON mfa_backup_codes FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

-- 2. TABLA OUTBOX TRANSACCIONAL Y DURADERA DE CORREO ELECTRÓNICO (C-04)
CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient VARCHAR(255) NOT NULL,
  template VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, SENT, FAILED
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_fetch ON email_outbox (status, next_attempt_at, created_at);

-- 3. FUNCIÓN DE REVOCACIÓN TOTAL DE SESIONES POR USUARIO (C-01 — SECURITY DEFINER)
CREATE OR REPLACE FUNCTION revoke_all_user_sessions_sec(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE user_sessions
  SET revoked_at = NOW()
  WHERE user_id = p_user_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 4. ÍNDICES DE RENDIMIENTO PARA CONSULTAS DE MULTITENANCY
CREATE INDEX IF NOT EXISTS idx_user_sessions_active_lookup 
  ON user_sessions (user_id, revoked_at, absolute_expires_at, idle_expires_at);

CREATE INDEX IF NOT EXISTS idx_org_memberships_active_lookup 
  ON organization_memberships (user_id, organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_invitations_active_lookup 
  ON invitations (organization_id, consumed_at, expires_at);

-- 5. PROPIEDAD DE OBJETOS Y PERMISOS
ALTER TABLE email_outbox OWNER TO app_owner;
ALTER INDEX idx_email_outbox_fetch OWNER TO app_owner;
ALTER INDEX idx_user_sessions_active_lookup OWNER TO app_owner;
ALTER INDEX idx_org_memberships_active_lookup OWNER TO app_owner;
ALTER INDEX idx_invitations_active_lookup OWNER TO app_owner;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'token_resolver') THEN
    ALTER FUNCTION revoke_all_user_sessions_sec(UUID) OWNER TO token_resolver;
  END IF;
END $$;

