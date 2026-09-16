-- ============================================================================
-- FASE 1: PRE-BOOTSTRAP DE ROLES Y GRUPOS DE SEGURIDAD CANÓNICOS (v0.3.10)
-- Ejecutar exclusivamente como SUPERUSUARIO ('postgres') antes de crear objetos
-- ============================================================================

-- Garantizar extensión pgcrypto de forma idempotente como superusuario postgres
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    -- 1. Rol Propietario de Esquema (app_owner)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
        CREATE ROLE app_owner WITH NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
    ELSE
        ALTER ROLE app_owner WITH NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
    END IF;

    -- 2. Rol Grupo de Usuario de Aplicación (app_user)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
    ELSE
        ALTER ROLE app_user WITH NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
    END IF;

    -- 3. Rol Grupo de Worker de Auditoría (audit_worker)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_worker') THEN
        CREATE ROLE audit_worker WITH NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
    ELSE
        ALTER ROLE audit_worker WITH NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
    END IF;

    -- 4. Rol Grupo de Lectura de Auditoría (audit_reader)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_reader') THEN
        CREATE ROLE audit_reader WITH NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
    ELSE
        ALTER ROLE audit_reader WITH NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
    END IF;

    -- 5. Rol Grupo de Despacho de Auditoría (audit_dispatcher)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_dispatcher') THEN
        CREATE ROLE audit_dispatcher WITH NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS NOREPLICATION;
    ELSE
        ALTER ROLE audit_dispatcher WITH NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS NOREPLICATION;
    END IF;

    -- 6. Rol de Conexión Runtime Específico del Servidor (politica_canon_app)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'politica_canon_app') THEN
        CREATE ROLE politica_canon_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION CONNECTION LIMIT 10;
    ELSE
        ALTER ROLE politica_canon_app WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION CONNECTION LIMIT 10;
    END IF;
END $$;

-- Enlazar la identidad de runtime al rol canónico app_user
GRANT app_user TO politica_canon_app;

-- Conceder app_owner a postgres para permitir SET ROLE app_owner en migraciones locales
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        GRANT app_owner TO postgres;
    END IF;
END $$;

-- Garantizar permisos de creación DDL en esquema public para app_owner desde la Fase 1
GRANT USAGE, CREATE ON SCHEMA public TO app_owner;

-- Garantizar que app_user y politica_canon_app tengan RLS activado obligatoriamente
ALTER ROLE app_user SET row_security = on;
ALTER ROLE politica_canon_app SET row_security = on;
