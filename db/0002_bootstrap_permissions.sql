-- ============================================================================
-- FASE 3: POST-BOOTSTRAP DE PROPIEDAD, PERMISOS MÍNIMOS Y RLS (v0.3.5)
-- Ejecutar exclusivamente como SUPERUSUARIO ('postgres') tras aplicar DDLs
-- ============================================================================

-- 1. C-03: Transferencia de propiedad del esquema public a app_owner
-- NOTA: ALTER DATABASE ... OWNER TO app_owner se ejecuta fuera de bloque transaccional en bootstrap-post.mjs (C-01)
ALTER SCHEMA public OWNER TO app_owner;

-- Revocación estricta de permisos de creación en el esquema public
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO app_owner;
REVOKE CREATE ON SCHEMA public FROM politica_canon_app;
REVOKE CREATE ON SCHEMA public FROM app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA public TO politica_canon_app;
GRANT USAGE ON SCHEMA public TO audit_worker;
GRANT USAGE ON SCHEMA public TO audit_dispatcher;
GRANT USAGE ON SCHEMA public TO audit_reader;

-- 2. C-03 / C-02: Transferencia de propiedad por firma exacta e inmutabilidad de excepciones
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO app_owner;', r.tablename);
    END LOOP;

    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO app_owner;', r.sequence_name);
    END LOOP;

    FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') LOOP
        EXECUTE format('ALTER VIEW public.%I OWNER TO app_owner;', r.table_name);
    END LOOP;
    
    -- Transferir funciones usando pg_proc e identidades exactas, exceptuando el despachador de auditoría
    FOR r IN (
        SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname != 'get_pending_outbox_tenants'
    ) LOOP
        EXECUTE format('ALTER FUNCTION public.%I(%s) OWNER TO app_owner;', r.proname, r.args);
    END LOOP;

    -- Asignación explícita de propiedad de get_pending_outbox_tenants a audit_dispatcher (C-02)
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p 
        JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'get_pending_outbox_tenants'
    ) THEN
        ALTER FUNCTION public.get_pending_outbox_tenants() OWNER TO audit_dispatcher;
    END IF;
END $$;

-- H-01: Revocación de privilegios por defecto para evitar que futuras funciones sean ejecutables por PUBLIC
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 3. H-02: Matriz de mínimos privilegios DML explícitos (0 GRANT ALL)
-- Tablas operativas de borradores y sesiones: DML permitido
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_versions TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO app_user;
GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO app_user;

-- Tablas de control y gobernanza: SOLO LECTURA (SELECT) para app_user
GRANT SELECT ON public.organizations TO app_user;
GRANT SELECT ON public.workspaces TO app_user;
GRANT SELECT ON public.authority_bodies TO app_user;
GRANT SELECT ON public.authority_memberships TO app_user;
GRANT SELECT ON public.organization_memberships TO app_user;
GRANT SELECT ON public.users TO app_user;
GRANT SELECT ON public.role_assignments TO app_user;
GRANT SELECT ON public.decisions TO app_user;
GRANT SELECT ON public.decision_votes TO app_user;
GRANT SELECT ON public.publications TO app_user;
GRANT SELECT ON public.publication_events TO app_user;

-- Concesión de solo lectura en tabla de control de migraciones
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations') THEN
        GRANT SELECT ON public.schema_migrations TO app_user;
    END IF;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Revocación explícita de escritura directa en tablas de control, gobernanza y auditoría
REVOKE INSERT, UPDATE, DELETE ON public.organizations, public.workspaces, public.authority_bodies, public.authority_memberships, public.organization_memberships, public.users, public.role_assignments, public.decisions, public.decision_votes, public.publications, public.publication_events, public.audit_events, public.audit_outbox FROM app_user;

REVOKE INSERT, UPDATE, DELETE ON public.organizations, public.workspaces, public.authority_bodies, public.authority_memberships, public.organization_memberships, public.users, public.role_assignments, public.decisions, public.decision_votes, public.publications, public.publication_events, public.audit_events, public.audit_outbox FROM politica_canon_app;

-- Concesiones para audit_worker y audit_reader
GRANT SELECT, INSERT, UPDATE ON public.audit_outbox TO audit_worker;
GRANT SELECT, INSERT, UPDATE ON public.audit_events TO audit_worker;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_outbox_dead_letter') THEN
        GRANT SELECT, INSERT, UPDATE ON public.audit_outbox_dead_letter TO audit_worker;
    END IF;
END $$;

GRANT SELECT ON public.audit_events, public.publication_events TO audit_reader;

-- 4. C-05 / C-02: Revocación total de ejecución de funciones a PUBLIC y concesión explicita por firma
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cast_vote_transactional(UUID, UUID, UUID, UUID, UUID, UUID, UUID, VARCHAR) TO app_user;
GRANT EXECUTE ON FUNCTION public.approve_decision_transactional(UUID, UUID, UUID, UUID, UUID, UUID, UUID, VARCHAR, TEXT) TO app_user;
GRANT EXECUTE ON FUNCTION public.finalize_decision_transactional(UUID, UUID, UUID, UUID, UUID, UUID, UUID, VARCHAR, TEXT) TO app_user;
GRANT EXECUTE ON FUNCTION public.submit_document_draft_transactional(UUID, UUID, UUID, UUID, UUID) TO app_user;
GRANT EXECUTE ON FUNCTION public.freeze_document_submission_transactional(UUID, UUID, UUID, UUID, UUID) TO app_user;
GRANT EXECUTE ON FUNCTION public.publish_document_transactional(UUID, UUID, UUID, UUID, UUID, UUID, publication_format_enum, VARCHAR, CHAR(64), CHAR(64)) TO app_user;
GRANT EXECUTE ON FUNCTION public.grant_governance_role_transactional(UUID, UUID) TO app_user;
GRANT EXECUTE ON FUNCTION public.jcs_canonicalize_jsonb(jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.jcs_format_number(numeric) TO app_user;
GRANT EXECUTE ON FUNCTION public.jcs_utf16_sort_key(text) TO app_user;
GRANT EXECUTE ON FUNCTION public.check_mfa_freshness() TO app_user;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain(UUID) TO app_user;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain(UUID) TO audit_reader;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain(UUID) TO audit_worker;

-- Restricción estricta de get_pending_outbox_tenants a audit_worker (C-02)
REVOKE EXECUTE ON FUNCTION public.get_pending_outbox_tenants() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pending_outbox_tenants() FROM app_user;
REVOKE EXECUTE ON FUNCTION public.get_pending_outbox_tenants() FROM politica_canon_app;
GRANT EXECUTE ON FUNCTION public.get_pending_outbox_tenants() TO audit_worker;

-- 5. Imposición estricta de Row Level Security (RLS) en todas las tablas tenant-scoped
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'organization_id'
        GROUP BY table_name
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.table_name);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', r.table_name);
    END LOOP;
END $$;
