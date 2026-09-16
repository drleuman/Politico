-- Migración DDL Incremental — Política Canon v0.3.15 (Fase 1.1 Correctiva)
-- Transferencia formal de propiedad de funciones de resolución al rol token_resolver (BYPASSRLS)
-- Motorización: PostgreSQL 16+
-- Ejecutante obligatorio: app_owner (SET ROLE app_owner)

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
