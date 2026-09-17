-- ============================================================================
-- Reversión de Migración DDL — Política Canon v0.3.21 (0005_fase_1_1_functional_down.sql)
-- Restaura Fielmente las Políticas RLS y Elimina los Índices de Fase 1.1
-- ============================================================================

-- 1. ELIMINAR Y RESTAURAR POLÍTICAS RLS DE AISLAMIENTO MULTITENANT PREVIAS
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

-- 2. ELIMINAR ÍNDICES CREADOS EN 0005
DROP INDEX IF EXISTS idx_user_sessions_active_lookup;
DROP INDEX IF EXISTS idx_org_memberships_active_lookup;
DROP INDEX IF EXISTS idx_invitations_active_lookup;
