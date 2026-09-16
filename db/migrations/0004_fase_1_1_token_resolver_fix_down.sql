-- Migración DDL Rollback — Política Canon v0.3.15 (Fase 1.1 Correctiva)
-- Reversión de propiedad de funciones de resolución a app_owner

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'resolve_session_by_token') THEN
        ALTER FUNCTION resolve_session_by_token(CHAR(64)) OWNER TO app_owner;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'resolve_invitation_by_token') THEN
        ALTER FUNCTION resolve_invitation_by_token(CHAR(64)) OWNER TO app_owner;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_user_active_memberships') THEN
        ALTER FUNCTION get_user_active_memberships(UUID) OWNER TO app_owner;
    END IF;
END $$;
