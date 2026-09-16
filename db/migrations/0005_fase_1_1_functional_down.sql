-- Rollback DDL — Política Canon v0.3.18 (0005_fase_1_1_functional_down)
-- Motorización: PostgreSQL 16+

DROP INDEX IF EXISTS idx_org_memberships_org_user;
DROP INDEX IF EXISTS idx_user_sessions_org_user_active;
DROP INDEX IF EXISTS idx_users_email_active;
