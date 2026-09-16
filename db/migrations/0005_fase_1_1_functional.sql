-- Migración DDL Incremental — Política Canon v0.3.18 (Fase 1.1 Funcional)
-- Optimización de consultas de Identidad, Sesiones y Membresías
-- Motorización: PostgreSQL 16+
-- Ejecutante obligatorio: app_owner (SET ROLE app_owner)

-- 1. ÍNDICES DE ALTO RENDIMIENTO PARA BÚSQUEDAS DE SESIONES Y USUARIOS POR ORGANIZACIÓN
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_user ON organization_memberships(organization_id, user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_org_user_active ON user_sessions(organization_id, user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(LOWER(email)) WHERE is_active = TRUE;

-- 2. ASEGURAR PROPIEDAD DE RESOLVERS EN token_resolver
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'token_resolver') THEN
        IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'resolve_session_by_token') THEN
            ALTER FUNCTION resolve_session_by_token(CHAR(64)) OWNER TO token_resolver;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'resolve_invitation_by_token') THEN
            ALTER FUNCTION resolve_invitation_by_token(CHAR(64)) OWNER TO token_resolver;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_user_active_memberships') THEN
            ALTER FUNCTION get_user_active_memberships(UUID) OWNER TO token_resolver;
        END IF;
    END IF;
END $$;
