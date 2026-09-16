-- ============================================================================
-- FASE 3: POST-BOOTSTRAP DE PROPIEDAD, PERMISOS MÍNIMOS Y RLS (v0.3.2)
-- Ejecutar exclusivamente como SUPERUSUARIO ('postgres') tras aplicar DDLs
-- ============================================================================

-- 1. Transferencia de propiedad de todos los objetos a app_owner
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
END $$;

-- 2. Concesión de uso del esquema public a app_user
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_owner;

-- 3. Concesión de permisos DML mínimos a app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 4. Revocación de INSERT directo en decision_votes para app_user (Exige uso de funciones SECURITY DEFINER)
REVOKE INSERT ON public.decision_votes FROM app_user;

-- 5. Concesión de ejecución de funciones SECURITY DEFINER
GRANT EXECUTE ON FUNCTION cast_vote_transactional TO app_user;
GRANT EXECUTE ON FUNCTION approve_decision_transactional TO app_user;
GRANT EXECUTE ON FUNCTION finalize_decision_transactional TO app_user;
GRANT EXECUTE ON FUNCTION jcs_canonicalize_jsonb TO app_user;

-- 6. Imposición estricta de Row Level Security (RLS) en todas las tablas tenant-scoped
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
