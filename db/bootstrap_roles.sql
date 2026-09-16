-- Provisioning de Roles de Base de Datos, Dominio de Esquema y Mínimo Privilegio para PostgreSQL 16+ (v0.2.11)

-- 1. Rol Propietario / Migraciones (DDL Schema Owner - Non-superuser)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_owner') THEN
    CREATE ROLE app_owner WITH LOGIN NOINHERIT CREATEDB;
  END IF;
END $$;

-- 2. Rol de Aplicación (Runtime API User - NOBYPASSRLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

-- 3. Rol del Trabajador de Auditoría (Audit Outbox Worker)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_worker') THEN
    CREATE ROLE audit_worker WITH LOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

-- 4. Rol Lectura de Auditoría (Audit Reader)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_reader') THEN
    CREATE ROLE audit_reader WITH LOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

-- 5. Rol Despachador de Tenants para Worker (NOLOGIN BYPASSRLS) (C-03)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_dispatcher') THEN
    CREATE ROLE audit_dispatcher NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- 6. ASIGNACIÓN REAL DE PROPIEDAD DEL ESQUEMA Y OBJETOS A app_owner Y audit_dispatcher (C-03, C-05)
ALTER SCHEMA public OWNER TO app_owner;

ALTER TABLE organizations OWNER TO app_owner;
ALTER TABLE workspaces OWNER TO app_owner;
ALTER TABLE users OWNER TO app_owner;
ALTER TABLE user_credentials OWNER TO app_owner;
ALTER TABLE invitations OWNER TO app_owner;
ALTER TABLE password_reset_tokens OWNER TO app_owner;
ALTER TABLE organization_memberships OWNER TO app_owner;
ALTER TABLE workspace_memberships OWNER TO app_owner;
ALTER TABLE authority_bodies OWNER TO app_owner;
ALTER TABLE authority_memberships OWNER TO app_owner;
ALTER TABLE documents OWNER TO app_owner;
ALTER TABLE document_versions OWNER TO app_owner;
ALTER TABLE working_drafts OWNER TO app_owner;
ALTER TABLE draft_comments OWNER TO app_owner;
ALTER TABLE submissions OWNER TO app_owner;
ALTER TABLE reviews OWNER TO app_owner;
ALTER TABLE decisions OWNER TO app_owner;
ALTER TABLE decision_votes OWNER TO app_owner;
ALTER TABLE publications OWNER TO app_owner;
ALTER TABLE publication_events OWNER TO app_owner;
ALTER TABLE document_invalidations OWNER TO app_owner;
ALTER TABLE source_citations OWNER TO app_owner;
ALTER TABLE role_assignment_requests OWNER TO app_owner;
ALTER TABLE role_assignment_approvals OWNER TO app_owner;
ALTER TABLE role_assignments OWNER TO app_owner;
ALTER TABLE user_sessions OWNER TO app_owner;
ALTER TABLE mfa_backup_codes OWNER TO app_owner;
ALTER TABLE audit_outbox OWNER TO app_owner;
ALTER TABLE audit_events OWNER TO app_owner;
ALTER TABLE audit_outbox_dead_letter OWNER TO app_owner;

ALTER FUNCTION protect_document_status_transitions OWNER TO app_owner;
ALTER FUNCTION submit_document_draft_transactional OWNER TO app_owner;
ALTER FUNCTION freeze_document_submission_transactional OWNER TO app_owner;
ALTER FUNCTION cast_vote_transactional OWNER TO app_owner;
ALTER FUNCTION finalize_decision_transactional OWNER TO app_owner;
ALTER FUNCTION approve_decision_transactional OWNER TO app_owner;
ALTER FUNCTION publish_document_transactional OWNER TO app_owner;
ALTER FUNCTION get_pending_outbox_tenants OWNER TO audit_dispatcher;
ALTER FUNCTION verify_audit_chain OWNER TO app_owner;
ALTER FUNCTION grant_governance_role_transactional OWNER TO app_owner;
ALTER FUNCTION prevent_modification_or_deletion OWNER TO app_owner;

-- 7. REVOCACIÓN DE PERMISOS PÚBLICOS
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO app_owner;
GRANT USAGE ON SCHEMA public TO app_user, audit_worker, audit_reader, audit_dispatcher;

-- 8. OTORGAR PRIVILEGIOS MÍNIMOS DML A app_user (H-04)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE 
  working_drafts, draft_comments, user_sessions, mfa_backup_codes
TO app_user;

GRANT SELECT, INSERT ON TABLE 
  role_assignment_requests, role_assignment_approvals
TO app_user;

GRANT SELECT ON TABLE 
  organizations, workspaces, users, user_credentials, invitations, password_reset_tokens,
  organization_memberships, workspace_memberships, authority_bodies, authority_memberships,
  documents, document_versions, submissions, reviews, decisions, decision_votes, publications, publication_events,
  source_citations, document_invalidations, role_assignments
TO app_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- REVOCAR ESCRITURAS DIRECTAS EN TABLAS SENSIBLES (C-03, C-04, H-04)
REVOKE INSERT, UPDATE, DELETE ON role_assignments, decisions, decision_votes, publications, publication_events, audit_events, audit_outbox, audit_outbox_dead_letter FROM app_user;
REVOKE UPDATE (status) ON documents FROM app_user;

-- Permisos de Ejecución sobre Funciones Transaccionales Protegidas
GRANT EXECUTE ON FUNCTION grant_governance_role_transactional(UUID, UUID) TO app_user;
GRANT EXECUTE ON FUNCTION submit_document_draft_transactional(UUID, UUID, UUID, UUID, UUID) TO app_user;
GRANT EXECUTE ON FUNCTION freeze_document_submission_transactional(UUID, UUID, UUID, UUID, UUID) TO app_user;
GRANT EXECUTE ON FUNCTION cast_vote_transactional(UUID, UUID, UUID, UUID, UUID, UUID, UUID, VARCHAR) TO app_user;
GRANT EXECUTE ON FUNCTION finalize_decision_transactional(UUID, UUID, UUID, UUID, UUID, UUID, UUID, VARCHAR, TEXT) TO app_user;
GRANT EXECUTE ON FUNCTION approve_decision_transactional(UUID, UUID, UUID, UUID, UUID, UUID, UUID, VARCHAR, TEXT) TO app_user;
GRANT EXECUTE ON FUNCTION publish_document_transactional(UUID, UUID, UUID, UUID, UUID, UUID, publication_format_enum, VARCHAR, CHAR(64), CHAR(64)) TO app_user;
GRANT EXECUTE ON FUNCTION verify_audit_chain(UUID) TO app_user, audit_reader, audit_worker;

-- 9. PRIVILEGIOS ESPECÍFICOS DEL WORKER DE AUDITORÍA Y DESPACHADOR (C-03, C-04, H-04)
GRANT SELECT ON TABLE audit_outbox TO audit_dispatcher;
GRANT SELECT, INSERT, UPDATE ON TABLE audit_outbox, audit_events, audit_outbox_dead_letter TO audit_worker;
REVOKE DELETE ON TABLE audit_events FROM audit_worker;
REVOKE ALL ON FUNCTION get_pending_outbox_tenants() FROM PUBLIC, app_user, audit_reader;
GRANT EXECUTE ON FUNCTION get_pending_outbox_tenants() TO audit_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO audit_worker;

-- 10. PRIVILEGIOS DE SOLO LECTURA PARA audit_reader
GRANT SELECT ON TABLE audit_events, publication_events TO audit_reader;

