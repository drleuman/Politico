-- ============================================================================
-- Reversión de Migración DDL — Política Canon v0.3.19 (0005_fase_1_1_functional_down.sql)
-- ============================================================================

DROP INDEX IF EXISTS idx_user_sessions_active_lookup;
DROP INDEX IF EXISTS idx_org_memberships_active_lookup;
DROP INDEX IF EXISTS idx_invitations_active_lookup;
