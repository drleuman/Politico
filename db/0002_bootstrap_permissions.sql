-- ============================================================================
-- FASE 3: POST-BOOTSTRAP DE PROPIEDAD, PERMISOS MÍNIMOS Y RLS (v0.3.30)
-- Ejecutar exclusivamente como SUPERUSUARIO ('postgres') tras aplicar DDLs
-- ============================================================================

-- Concesión explícita de permiso de conexión a la base de datos para el rol runtime
GRANT CONNECT ON DATABASE politica_canon TO politica_canon_app;

-- 1. C-03: Transferencia de propiedad del esquema public a app_owner
-- NOTA: ALTER DATABASE ... OWNER TO app_owner se ejecuta fuera de bloque transaccional en bootstrap-post.mjs (C-01)
ALTER SCHEMA public OWNER TO app_owner;

-- Revocación estricta de permisos de creación en el esquema public
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO app_owner;
REVOKE CREATE ON SCHEMA public FROM politica_canon_app;
REVOKE CREATE ON SCHEMA public FROM app_user;
REVOKE CREATE ON SCHEMA public FROM token_resolver;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA public TO politica_canon_app;
GRANT USAGE ON SCHEMA public TO audit_worker;
GRANT USAGE ON SCHEMA public TO audit_dispatcher;
GRANT USAGE ON SCHEMA public TO audit_reader;
GRANT USAGE ON SCHEMA public TO token_resolver;

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
    
    -- Transferir funciones usando pg_proc e identidades exactas, exceptuando el despachador de auditoría, resolvers y revocador de sesiones
    FOR r IN (
        SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname NOT IN (
            'get_pending_outbox_tenants',
            'resolve_session_by_token',
            'resolve_invitation_by_token',
            'get_user_active_memberships',
            'revoke_all_user_sessions_sec'
          )
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

    -- Asignación explícita de propiedad de las funciones de resolución y revocación a token_resolver (BYPASSRLS)
    FOR r IN (
        SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'resolve_session_by_token',
            'resolve_invitation_by_token',
            'get_user_active_memberships',
            'revoke_all_user_sessions_sec'
          )
    ) LOOP
        EXECUTE format('ALTER FUNCTION public.%I(%s) OWNER TO token_resolver;', r.proname, r.args);
    END LOOP;

    -- Garantizar que app_owner NO conserve membresía ni opción de administración en token_resolver
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
        REVOKE ADMIN OPTION FOR token_resolver FROM app_owner;
        REVOKE token_resolver FROM app_owner;
    END IF;
END $$;

-- H-01: Revocación de privilegios por defecto para evitar que futuras funciones sean ejecutables por PUBLIC
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 3. H-02: Matriz de mínimos privilegios DML explícitos (0 GRANT ALL)
-- Tablas operativas de borradores, invitaciones, usuarios y sesiones: DML permitido para la aplicación
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_versions TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_credentials TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sessions TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_tokens TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfa_backup_codes TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_memberships TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_memberships TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_assignments TO app_user, politica_canon_app;
GRANT SELECT, INSERT, UPDATE ON public.audit_outbox TO app_user, politica_canon_app;

-- C-01 & C-02 (v0.3.25): Creación y endurecimiento de rol LOGIN dedicado politica_canon_email_worker y grupo NOLOGIN email_worker (Sin contraseñas harcodeadas)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'email_worker') THEN
        CREATE ROLE email_worker WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    ELSE
        ALTER ROLE email_worker WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'politica_canon_email_worker') THEN
        CREATE ROLE politica_canon_email_worker WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    ELSE
        ALTER ROLE politica_canon_email_worker WITH LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    END IF;
END $$;

GRANT email_worker TO politica_canon_email_worker;
GRANT CONNECT ON DATABASE politica_canon TO politica_canon_email_worker, email_worker;

-- C-01 / C-02: La aplicación web runtime solo requiere INSERT y SELECT(id) sobre email_outbox para la cláusula RETURNING id
REVOKE SELECT, UPDATE, DELETE ON public.email_outbox FROM app_user, politica_canon_app;
GRANT INSERT, SELECT (id) ON public.email_outbox TO app_user, politica_canon_app;

-- Concesión acotada para token_resolver (BYPASSRLS)
GRANT USAGE ON SCHEMA public TO token_resolver;
GRANT SELECT, UPDATE ON public.user_sessions TO token_resolver;
GRANT SELECT ON public.invitations, public.organization_memberships, public.users TO token_resolver;

-- Tablas de control y gobernanza: SOLO LECTURA (SELECT) para app_user y politica_canon_app
GRANT SELECT ON public.organizations TO app_user, politica_canon_app;
GRANT SELECT ON public.workspaces TO app_user, politica_canon_app;
GRANT SELECT ON public.authority_bodies TO app_user, politica_canon_app;
GRANT SELECT ON public.authority_memberships TO app_user, politica_canon_app;
GRANT SELECT ON public.decisions TO app_user, politica_canon_app;
GRANT SELECT ON public.decision_votes TO app_user, politica_canon_app;
GRANT SELECT ON public.publications TO app_user, politica_canon_app;
GRANT SELECT ON public.publication_events TO app_user, politica_canon_app;

-- Concesión de solo lectura en tabla de control de migraciones
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations') THEN
        GRANT SELECT ON public.schema_migrations TO app_user, politica_canon_app;
    END IF;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user, politica_canon_app, email_worker, politica_canon_email_worker;

-- Revocación explícita de escritura directa en tablas inmutables de decisiones, publicaciones y auditoría eventos
REVOKE INSERT, UPDATE, DELETE ON public.organizations, public.workspaces, public.authority_bodies, public.authority_memberships, public.decisions, public.decision_votes, public.publications, public.publication_events, public.audit_events FROM app_user;

REVOKE INSERT, UPDATE, DELETE ON public.organizations, public.workspaces, public.authority_bodies, public.authority_memberships, public.decisions, public.decision_votes, public.publications, public.publication_events, public.audit_events FROM politica_canon_app;

-- Concesiones para audit_worker, audit_reader y email_worker (C-01, C-02, H-04 Mínimos Privilegios Exactos)
GRANT SELECT, INSERT, UPDATE ON public.audit_outbox TO audit_worker;
GRANT SELECT, INSERT, UPDATE ON public.audit_events TO audit_worker;
GRANT USAGE ON SCHEMA public TO email_worker, politica_canon_email_worker;
REVOKE INSERT, DELETE ON public.email_outbox FROM email_worker, politica_canon_email_worker;
GRANT SELECT, UPDATE ON public.email_outbox TO email_worker, app_owner;

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
GRANT EXECUTE ON FUNCTION public.resolve_session_by_token(CHAR(64)) TO app_user, politica_canon_app;
GRANT EXECUTE ON FUNCTION public.resolve_invitation_by_token(CHAR(64)) TO app_user, politica_canon_app;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain(UUID) TO app_user;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain(UUID) TO audit_reader;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain(UUID) TO audit_worker;

-- Restricción estricta de get_pending_outbox_tenants a audit_worker (C-02)
REVOKE EXECUTE ON FUNCTION public.get_pending_outbox_tenants() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pending_outbox_tenants() FROM app_user;
REVOKE EXECUTE ON FUNCTION public.get_pending_outbox_tenants() FROM politica_canon_app;
GRANT EXECUTE ON FUNCTION public.get_pending_outbox_tenants() TO audit_worker;

GRANT EXECUTE ON FUNCTION public.get_user_active_memberships(UUID) TO app_user, politica_canon_app;
GRANT EXECUTE ON FUNCTION public.revoke_all_user_sessions_sec(UUID) TO app_user, politica_canon_app;

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
