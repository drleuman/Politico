-- ============================================================================
-- FASE 3: POST-BOOTSTRAP DE PROPIEDAD, PERMISOS MÍNIMOS Y RLS (v0.3.3)
-- Ejecutar exclusivamente como SUPERUSUARIO ('postgres') tras aplicar DDLs
-- ============================================================================

-- 1. C-03: Transferencia de propiedad de la base de datos y del esquema public a app_owner
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_database WHERE datname = 'politica_canon') THEN
        ALTER DATABASE politica_canon OWNER TO app_owner;
    END IF;
END $$;

ALTER SCHEMA public OWNER TO app_owner;

-- Revocación estricta de permisos de creación en el esquema public
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM politica_canon_app;
REVOKE CREATE ON SCHEMA public FROM app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA public TO politica_canon_app;

-- 2. Transferencia de propiedad de todas las tablas, secuencias y vistas a app_owner
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
    
    FOR r IN (SELECT routine_name, specific_name FROM information_schema.routines WHERE routine_schema = 'public') LOOP
        EXECUTE format('ALTER FUNCTION public.%I OWNER TO app_owner;', r.routine_name);
    END LOOP;
END $$;

-- 3. C-04: Matriz de mínimos privilegios DML explícitos para app_user (0 GRANT ALL)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_versions TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sessions TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_memberships TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authority_bodies TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authority_memberships TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO app_user;

-- Concesión de solo lectura en tablas de control de migraciones y consulta
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations') THEN
        GRANT SELECT ON public.schema_migrations TO app_user;
    END IF;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Revocación explícita de escritura directa en tablas sensibles de gobernanza y auditoría
REVOKE INSERT, UPDATE, DELETE ON public.decision_votes FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON public.decisions FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON public.role_assignments FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON public.publications FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON public.publication_events FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON public.audit_events FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON public.audit_outbox FROM app_user;

REVOKE INSERT, UPDATE, DELETE ON public.decision_votes FROM politica_canon_app;
REVOKE INSERT, UPDATE, DELETE ON public.decisions FROM politica_canon_app;
REVOKE INSERT, UPDATE, DELETE ON public.role_assignments FROM politica_canon_app;
REVOKE INSERT, UPDATE, DELETE ON public.publications FROM politica_canon_app;
REVOKE INSERT, UPDATE, DELETE ON public.publication_events FROM politica_canon_app;
REVOKE INSERT, UPDATE, DELETE ON public.audit_events FROM politica_canon_app;
REVOKE INSERT, UPDATE, DELETE ON public.audit_outbox FROM politica_canon_app;

-- 4. C-05: Revocación total de ejecución de funciones a PUBLIC y concesión explicita por firma
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
GRANT EXECUTE ON FUNCTION public.get_pending_outbox_tenants() TO app_user;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain(UUID) TO app_user;

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
