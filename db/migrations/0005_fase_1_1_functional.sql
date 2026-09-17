-- ============================================================================
-- Migración DDL Incrementada Forward-Only — Política Canon v0.3.19
-- Fase 1.1 Funcional Remediada: Políticas RLS de Aislamiento Tenant e Índices
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

-- 2. ÍNDICES DE RENDIMIENTO PARA CONSULTAS DE MULTITENANCY
CREATE INDEX IF NOT EXISTS idx_user_sessions_active_lookup 
  ON user_sessions (user_id, revoked_at, absolute_expires_at, idle_expires_at);

CREATE INDEX IF NOT EXISTS idx_org_memberships_active_lookup 
  ON organization_memberships (user_id, organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_invitations_active_lookup 
  ON invitations (organization_id, consumed_at, expires_at);

-- 3. PROPIEDAD DE OBJETOS POR APP_OWNER
ALTER INDEX idx_user_sessions_active_lookup OWNER TO app_owner;
ALTER INDEX idx_org_memberships_active_lookup OWNER TO app_owner;
ALTER INDEX idx_invitations_active_lookup OWNER TO app_owner;
