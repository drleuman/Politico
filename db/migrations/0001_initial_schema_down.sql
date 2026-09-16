-- Migración de Reversión / Rollback DDL — Política Canon v0.2.17
-- Motorización: PostgreSQL 16+

-- 1. ELIMINACIÓN DE DISPARADORES Y FUNCIONES DE INMUTABILIDAD Y CONTROL
DROP TRIGGER IF EXISTS trg_protect_document_status ON documents;
DROP TRIGGER IF EXISTS trg_pub_events_immutability ON publication_events;
DROP TRIGGER IF EXISTS trg_role_approvals_immutability ON role_assignment_approvals;
DROP TRIGGER IF EXISTS trg_source_citations_immutability ON source_citations;
DROP TRIGGER IF EXISTS trg_doc_invalidations_immutability ON document_invalidations;
DROP TRIGGER IF EXISTS trg_submissions_immutability ON submissions;
DROP TRIGGER IF EXISTS trg_decisions_immutability ON decisions;
DROP TRIGGER IF EXISTS trg_reviews_immutability ON reviews;
DROP TRIGGER IF EXISTS trg_doc_versions_immutability ON document_versions;
DROP TRIGGER IF EXISTS trg_audit_events_immutability ON audit_events;

DROP FUNCTION IF EXISTS protect_document_status_transitions;
DROP FUNCTION IF EXISTS submit_document_draft_transactional;
DROP FUNCTION IF EXISTS freeze_document_submission_transactional;
DROP FUNCTION IF EXISTS cast_vote_transactional;
DROP FUNCTION IF EXISTS finalize_decision_transactional;
DROP FUNCTION IF EXISTS approve_decision_transactional;
DROP FUNCTION IF EXISTS publish_document_transactional;
DROP FUNCTION IF EXISTS prevent_modification_or_deletion CASCADE;
DROP FUNCTION IF EXISTS prevent_decisions_immutability_violation CASCADE;
DROP FUNCTION IF EXISTS grant_governance_role_transactional;
DROP FUNCTION IF EXISTS verify_audit_chain;
DROP FUNCTION IF EXISTS get_pending_outbox_tenants;
DROP FUNCTION IF EXISTS jcs_canonicalize_jsonb CASCADE;
DROP FUNCTION IF EXISTS jcs_utf16_sort_key CASCADE;
DROP FUNCTION IF EXISTS jcs_format_number CASCADE;
DROP FUNCTION IF EXISTS check_mfa_freshness CASCADE;

-- 2. ELIMINACIÓN DE TABLAS EN ORDEN INVERSO DE DEPENDENCIA
DROP TABLE IF EXISTS audit_outbox_dead_letter CASCADE;
DROP TABLE IF EXISTS audit_events CASCADE;
DROP TABLE IF EXISTS audit_outbox CASCADE;
DROP TABLE IF EXISTS mfa_backup_codes CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS role_assignments CASCADE;
DROP TABLE IF EXISTS role_assignment_approvals CASCADE;
DROP TABLE IF EXISTS role_assignment_requests CASCADE;
DROP TABLE IF EXISTS source_citations CASCADE;
DROP TABLE IF EXISTS document_invalidations CASCADE;
DROP TABLE IF EXISTS publication_events CASCADE;
DROP TABLE IF EXISTS publications CASCADE;
DROP TABLE IF EXISTS decision_votes CASCADE;
DROP TABLE IF EXISTS decisions CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS draft_comments CASCADE;
DROP TABLE IF EXISTS working_drafts CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS authority_memberships CASCADE;
DROP TABLE IF EXISTS authority_bodies CASCADE;
DROP TABLE IF EXISTS workspace_memberships CASCADE;
DROP TABLE IF EXISTS organization_memberships CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS user_credentials CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- 3. ELIMINACIÓN DE TIPOS Y ENUMERACIONES
DROP TYPE IF EXISTS scope_type_enum CASCADE;
DROP TYPE IF EXISTS publication_event_type_enum CASCADE;
DROP TYPE IF EXISTS publication_format_enum CASCADE;
DROP TYPE IF EXISTS request_status_enum CASCADE;
DROP TYPE IF EXISTS review_decision_enum CASCADE;
DROP TYPE IF EXISTS user_role_enum CASCADE;
DROP TYPE IF EXISTS publication_state_enum CASCADE;
DROP TYPE IF EXISTS resource_state_enum CASCADE;
DROP TYPE IF EXISTS classification_level CASCADE;

