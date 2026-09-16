-- Rollback de Provisioning de Roles y Permisos — Política Canon v0.2.11
-- Motorización: PostgreSQL 16+

-- 1. Devolución de Propiedad del Esquema a postgres
ALTER SCHEMA public OWNER TO postgres;

-- 2. Reasignación y Eliminación de Objetos Poseídos por Roles de Aplicación (H-03)
REASSIGN OWNED BY app_owner TO postgres;
DROP OWNED BY app_owner;

REASSIGN OWNED BY audit_dispatcher TO postgres;
DROP OWNED BY audit_dispatcher;

-- 3. Revocar Privilegios de Esquema
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_user, audit_worker, audit_reader, audit_dispatcher;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM app_user, audit_worker, audit_reader, audit_dispatcher;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_user, audit_worker, audit_reader, audit_dispatcher;
REVOKE ALL ON SCHEMA public FROM app_user, audit_worker, audit_reader, app_owner, audit_dispatcher;

-- 4. Eliminar Roles Provisionados
DROP ROLE IF EXISTS audit_reader;
DROP ROLE IF EXISTS audit_worker;
DROP ROLE IF EXISTS audit_dispatcher;
DROP ROLE IF EXISTS app_user;
DROP ROLE IF EXISTS app_owner;

