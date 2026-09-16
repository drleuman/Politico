-- Migración Inicial DDL Executable — Política Canon v0.2.11
-- Motorización: PostgreSQL 16+

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. ENUMERACIONES UNIFICADAS MULTI-TENANT
CREATE TYPE classification_level AS ENUM ('PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'RESTRINGIDO');
CREATE TYPE resource_state_enum AS ENUM ('DRAFT', 'SUBMITTED', 'FROZEN', 'APPROVED', 'PUBLISHED');
CREATE TYPE publication_state_enum AS ENUM ('ACTIVE', 'WITHDRAWN', 'REPLACED');
CREATE TYPE user_role_enum AS ENUM ('ADMIN', 'COORDINATOR', 'WRITER', 'REVIEWER', 'APPROVER', 'PUBLISHER', 'AUDITOR');
CREATE TYPE review_decision_enum AS ENUM ('ACCEPTED', 'REJECTED');
CREATE TYPE request_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE publication_format_enum AS ENUM ('PDF', 'HTML', 'EPUB', 'DOCX');
CREATE TYPE publication_event_type_enum AS ENUM ('PUBLISH', 'WITHDRAW', 'REPLACE');
CREATE TYPE scope_type_enum AS ENUM ('ORGANIZATION', 'WORKSPACE', 'AUTHORITY_BODY');

-- 1. ORGANIZACIONES (Global)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. WORKSPACES
CREATE TABLE workspaces (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, id),
    CONSTRAINT unique_org_workspace UNIQUE (organization_id, id)
);

-- 3. USUARIOS (Global)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    mfa_secret_encrypted TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CREDENCIALES DE USUARIO (Global)
CREATE TABLE user_credentials (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL, -- Argon2id
    password_algo VARCHAR(50) NOT NULL DEFAULT 'argon2id',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. INVITACIONES (Restricción de Roles Sensibles)
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    workspace_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    role user_role_enum NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, workspace_id) REFERENCES workspaces(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT check_invitation_role CHECK (role NOT IN ('ADMIN', 'APPROVER', 'PUBLISHER', 'AUDITOR'))
);

-- 6. TOKENS DE RECUPERACIÓN DE CONTRASEÑA (Global)
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. MEMBRESÍAS DE ORGANIZACIÓN
CREATE TABLE organization_memberships (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

-- 8. MEMBRESÍAS DE WORKSPACE (Restricción de roles sensibles directos)
CREATE TABLE workspace_memberships (
    organization_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    role user_role_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    PRIMARY KEY (organization_id, workspace_id, user_id),
    FOREIGN KEY (organization_id, workspace_id) REFERENCES workspaces(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, user_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE RESTRICT,
    CONSTRAINT check_ws_direct_role CHECK (role NOT IN ('ADMIN', 'APPROVER', 'PUBLISHER', 'AUDITOR'))
);

-- 9. ÓRGANOS DE AUTORIDAD
CREATE TABLE authority_bodies (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    body_type VARCHAR(50) NOT NULL, -- e.g., 'GOVERNANCE_REGISTRY'
    PRIMARY KEY (organization_id, id),
    CONSTRAINT unique_org_authority UNIQUE (organization_id, id)
);

-- 10. MEMBRESÍAS DE AUTORIDAD
CREATE TABLE authority_memberships (
    organization_id UUID NOT NULL,
    authority_body_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    role VARCHAR(50) NOT NULL DEFAULT 'APPROVER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    PRIMARY KEY (organization_id, authority_body_id, user_id),
    FOREIGN KEY (organization_id, authority_body_id) REFERENCES authority_bodies(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, user_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE RESTRICT
);

-- 11. DOCUMENTOS (Invariantes editoriales protegidos por trigger C-03)
CREATE TABLE documents (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    classification classification_level NOT NULL DEFAULT 'INTERNO',
    status resource_state_enum NOT NULL DEFAULT 'DRAFT',
    assigned_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    coauthor_user_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, id),
    FOREIGN KEY (organization_id, workspace_id) REFERENCES workspaces(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT unique_org_document UNIQUE (organization_id, id),
    CONSTRAINT unique_org_ws_document UNIQUE (organization_id, workspace_id, id)
);

-- 12. VERSIONES INMUTABLES DE DOCUMENTOS (Definida ANTES de working_drafts)
CREATE TABLE document_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    document_id UUID NOT NULL,
    version_number INT NOT NULL,
    content_hash CHAR(64) NOT NULL,
    frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, id),
    FOREIGN KEY (organization_id, workspace_id, document_id) REFERENCES documents(organization_id, workspace_id, id) ON DELETE RESTRICT,
    CONSTRAINT unique_org_doc_version UNIQUE (organization_id, id),
    CONSTRAINT unique_org_doc_version_triple UNIQUE (organization_id, document_id, id),
    CONSTRAINT unique_org_ws_doc_version_quad UNIQUE (organization_id, workspace_id, document_id, id),
    CONSTRAINT unique_org_doc_version_number UNIQUE (organization_id, document_id, version_number)
);

-- 13. BORRADORES DE TRABAJO (OCC, Coautores y FK compuesta a document_versions)
CREATE TABLE working_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    document_id UUID NOT NULL,
    base_version_id UUID,
    revision_number INT NOT NULL DEFAULT 1,
    coauthor_user_ids JSONB DEFAULT '[]'::jsonb,
    content_ast JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, document_id) REFERENCES documents(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, base_version_id) REFERENCES document_versions(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT unique_org_working_draft UNIQUE (organization_id, id)
);

-- 14. COMENTARIOS EN BORRADOR (Integridad multitenant compuesta)
CREATE TABLE draft_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    draft_id UUID NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),
    anchor_position JSONB NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, draft_id) REFERENCES working_drafts(organization_id, id) ON DELETE CASCADE
);

-- 15. SUBMISSIONS / RONDAS DE REVISIÓN (Ciclos de revisión explícitos)
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    document_id UUID NOT NULL,
    version_id UUID NOT NULL,
    submitted_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    review_cycle INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, workspace_id) REFERENCES workspaces(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, document_id) REFERENCES documents(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, version_id) REFERENCES document_versions(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, document_id, version_id) REFERENCES document_versions(organization_id, document_id, id) ON DELETE RESTRICT,
    CONSTRAINT unique_org_submission UNIQUE (organization_id, id),
    CONSTRAINT unique_org_sub_quad UNIQUE (organization_id, workspace_id, document_id, version_id, id)
);

-- 16. REVISIONES DE REVISOR (Inmutable, Anti-CASCADE, Unicidad y FK por ciclo H-02)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    document_id UUID NOT NULL,
    version_id UUID NOT NULL,
    submission_id UUID NOT NULL,
    reviewer_id UUID NOT NULL REFERENCES users(id),
    decision review_decision_enum NOT NULL,
    review_cycle INT NOT NULL DEFAULT 1,
    feedback_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, workspace_id) REFERENCES workspaces(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, version_id) REFERENCES document_versions(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, submission_id) REFERENCES submissions(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, workspace_id, document_id, version_id, submission_id) REFERENCES submissions(organization_id, workspace_id, document_id, version_id, id) ON DELETE RESTRICT,
    CONSTRAINT unique_submission_reviewer_cycle UNIQUE (organization_id, submission_id, reviewer_id, review_cycle)
);

-- 17. DECISIONES DE AUTORIDAD (Inmutable, Enlazada a Submission H-02, Quórum y Evidencia)
CREATE TABLE decisions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    authority_body_id UUID NOT NULL,
    document_id UUID NOT NULL,
    version_id UUID NOT NULL,
    submission_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    voting_quorum_count INT NOT NULL DEFAULT 1 CHECK (voting_quorum_count > 0),
    approval_votes_count INT NOT NULL DEFAULT 0 CHECK (approval_votes_count >= 0),
    evidence_summary TEXT,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, id),
    FOREIGN KEY (organization_id, workspace_id) REFERENCES workspaces(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, authority_body_id) REFERENCES authority_bodies(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, version_id) REFERENCES document_versions(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, submission_id) REFERENCES submissions(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, workspace_id, document_id, version_id, submission_id) REFERENCES submissions(organization_id, workspace_id, document_id, version_id, id) ON DELETE RESTRICT,
    CONSTRAINT unique_org_decision UNIQUE (organization_id, id),
    CONSTRAINT unique_org_decision_version UNIQUE (organization_id, version_id, id)
);

-- 17B. VOTOS DE DECISIÓN REGISTRADOS (H-02)
CREATE TABLE decision_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    decision_id UUID NOT NULL,
    voter_id UUID NOT NULL REFERENCES users(id),
    vote_decision VARCHAR(20) NOT NULL CHECK (vote_decision IN ('APPROVE', 'REJECT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, decision_id) REFERENCES decisions(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT unique_decision_voter UNIQUE (organization_id, decision_id, voter_id)
);

-- 18. PUBLICACIONES (FKs corregidas y claves compuestas exactas)
CREATE TABLE publications (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    document_id UUID NOT NULL,
    version_id UUID NOT NULL,
    decision_id UUID NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    publisher_id UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (organization_id, id),
    FOREIGN KEY (organization_id, workspace_id) REFERENCES workspaces(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, document_id, version_id) REFERENCES document_versions(organization_id, document_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, version_id, decision_id) REFERENCES decisions(organization_id, version_id, id) ON DELETE RESTRICT,
    CONSTRAINT unique_org_publication UNIQUE (organization_id, id),
    CONSTRAINT unique_org_publication_decision UNIQUE (organization_id, id, decision_id)
);

-- 19. EVENTOS DE PUBLICACIÓN (Append-Only, Anti-CASCADE)
CREATE TABLE publication_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    publication_id UUID NOT NULL,
    event_type publication_event_type_enum NOT NULL,
    decision_id UUID NOT NULL,
    artifact_key VARCHAR(512),
    content_hash CHAR(64) NOT NULL,
    artifact_hash CHAR(64),
    format publication_format_enum NOT NULL,
    template_version VARCHAR(50) NOT NULL,
    renderer_version VARCHAR(50) NOT NULL,
    render_params JSONB NOT NULL,
    reason TEXT,
    replaced_publication_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    FOREIGN KEY (organization_id, publication_id) REFERENCES publications(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, decision_id) REFERENCES decisions(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, replaced_publication_id) REFERENCES publications(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, publication_id, decision_id) REFERENCES publications(organization_id, id, decision_id) ON DELETE RESTRICT,
    CONSTRAINT check_publish_fields CHECK (event_type != 'PUBLISH' OR (artifact_key IS NOT NULL AND artifact_hash IS NOT NULL AND format IS NOT NULL)),
    CONSTRAINT check_withdraw_fields CHECK (event_type != 'WITHDRAW' OR reason IS NOT NULL),
    CONSTRAINT check_replace_fields CHECK (event_type != 'REPLACE' OR (replaced_publication_id IS NOT NULL AND reason IS NOT NULL))
);

-- 20. INVALIDACIONES DOCUMENTALES
CREATE TABLE document_invalidations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    document_id UUID NOT NULL,
    version_id UUID NOT NULL,
    invalidated_by UUID NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, document_id) REFERENCES documents(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, version_id) REFERENCES document_versions(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, document_id, version_id) REFERENCES document_versions(organization_id, document_id, id) ON DELETE RESTRICT
);

-- 21. CITAS DE FUENTES Y EVIDENCIA
CREATE TABLE source_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    version_id UUID NOT NULL,
    source_title VARCHAR(255) NOT NULL,
    uri TEXT,
    citation_locator VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, version_id) REFERENCES document_versions(organization_id, id) ON DELETE RESTRICT
);

-- 22. SOLICITUDES DE ASIGNACIÓN DE ROL (Incorpora target_authority_body_id C-02)
CREATE TABLE role_assignment_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    target_workspace_id UUID NOT NULL,
    target_authority_body_id UUID,
    target_user_id UUID NOT NULL REFERENCES users(id),
    requested_role user_role_enum NOT NULL,
    requester_id UUID NOT NULL REFERENCES users(id),
    status request_status_enum NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, id),
    FOREIGN KEY (organization_id, target_workspace_id) REFERENCES workspaces(organization_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, target_authority_body_id) REFERENCES authority_bodies(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT check_requester_not_target CHECK (requester_id <> target_user_id),
    CONSTRAINT unique_org_role_request UNIQUE (organization_id, id)
);

-- 23. APROBACIONES DE ROL (ON DELETE RESTRICT, Order CHECK 1..2)
CREATE TABLE role_assignment_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    request_id UUID NOT NULL,
    approver_id UUID NOT NULL REFERENCES users(id),
    approval_order INT NOT NULL,
    decision_notes TEXT,
    evidence_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, request_id) REFERENCES role_assignment_requests(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT check_approval_order CHECK (approval_order IN (1, 2)),
    CONSTRAINT unique_org_request_order UNIQUE (organization_id, request_id, approval_order),
    CONSTRAINT unique_org_approver_request UNIQUE (organization_id, request_id, approver_id)
);

-- 24. ASIGNACIÓN EFECTIVA Y PERSISTENTE DE ROLES
CREATE TABLE role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    scope_type scope_type_enum NOT NULL DEFAULT 'WORKSPACE',
    scope_id UUID NOT NULL,
    target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_role user_role_enum NOT NULL,
    request_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    granted_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id, request_id) REFERENCES role_assignment_requests(organization_id, id) ON DELETE RESTRICT
);

-- 25. SESIONES DE USUARIO
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sid_hash CHAR(64) NOT NULL UNIQUE,
    anti_csrf_token_hash CHAR(64) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idle_expires_at TIMESTAMPTZ NOT NULL,
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

-- 26. CÓDIGOS DE RESPALDO MFA
CREATE TABLE mfa_backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 28. AUDIT OUTBOX (Atómico en Transacción de Negocio)
CREATE TABLE audit_outbox (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    event_type VARCHAR(100) NOT NULL,
    actor_id UUID NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER')),
    claimed_at TIMESTAMPTZ,
    locked_by VARCHAR(100),
    lease_duration_seconds INT NOT NULL DEFAULT 30,
    retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    PRIMARY KEY (organization_id, id),
    CONSTRAINT unique_org_outbox UNIQUE (organization_id, id)
);

-- 27. AUDITORÍA APPEND-ONLY (FK NOT NULL Compuesta a audit_outbox)
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sequence_number BIGINT NOT NULL CHECK (sequence_number > 0),
    event_type VARCHAR(100) NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    outbox_id UUID NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    schema_version VARCHAR(10) NOT NULL DEFAULT '1.0',
    previous_event_hash CHAR(64) NOT NULL,
    event_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, outbox_id) REFERENCES audit_outbox(organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT unique_org_sequence UNIQUE (organization_id, sequence_number)
);

-- 29. AUDIT OUTBOX DEAD LETTER (FK Compuesta a audit_outbox)
CREATE TABLE audit_outbox_dead_letter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    outbox_id UUID NOT NULL,
    error_message TEXT NOT NULL,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (organization_id, outbox_id) REFERENCES audit_outbox(organization_id, id) ON DELETE RESTRICT
);

-- POLÍTICAS DE ROW-LEVEL SECURITY (RLS) EN 25 TABLAS TENANT-SCOPED
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY; ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY; ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY; ALTER TABLE organization_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY; ALTER TABLE workspace_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE authority_bodies ENABLE ROW LEVEL SECURITY; ALTER TABLE authority_bodies FORCE ROW LEVEL SECURITY;
ALTER TABLE authority_memberships ENABLE ROW LEVEL SECURITY; ALTER TABLE authority_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY; ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY; ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE working_drafts ENABLE ROW LEVEL SECURITY; ALTER TABLE working_drafts FORCE ROW LEVEL SECURITY;
ALTER TABLE draft_comments ENABLE ROW LEVEL SECURITY; ALTER TABLE draft_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY; ALTER TABLE submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY; ALTER TABLE reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY; ALTER TABLE decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE publications ENABLE ROW LEVEL SECURITY; ALTER TABLE publications FORCE ROW LEVEL SECURITY;
ALTER TABLE publication_events ENABLE ROW LEVEL SECURITY; ALTER TABLE publication_events FORCE ROW LEVEL SECURITY;
ALTER TABLE document_invalidations ENABLE ROW LEVEL SECURITY; ALTER TABLE document_invalidations FORCE ROW LEVEL SECURITY;
ALTER TABLE source_citations ENABLE ROW LEVEL SECURITY; ALTER TABLE source_citations FORCE ROW LEVEL SECURITY;
ALTER TABLE role_assignment_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE role_assignment_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE role_assignment_approvals ENABLE ROW LEVEL SECURITY; ALTER TABLE role_assignment_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY; ALTER TABLE role_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY; ALTER TABLE user_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY; ALTER TABLE mfa_backup_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_outbox ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_outbox_dead_letter ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_outbox_dead_letter FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON workspaces FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON invitations FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON organization_memberships FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON workspace_memberships FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON authority_bodies FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON authority_memberships FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON documents FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON document_versions FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON working_drafts FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON draft_comments FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON submissions FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON reviews FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON decisions FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON publications FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON publication_events FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON document_invalidations FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON source_citations FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON role_assignment_requests FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON role_assignment_approvals FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON role_assignments FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON user_sessions FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON mfa_backup_codes FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON audit_events FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON audit_outbox FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
CREATE POLICY tenant_isolation_policy ON audit_outbox_dead_letter FOR ALL USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID) WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

-- PROTECCIÓN DE TRANSICIONES EDITORIALES EN BASE DE DATOS (C-03, H-01)
CREATE OR REPLACE FUNCTION protect_document_status_transitions()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.allow_protected_transition', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'DIRECT_STATUS_MUTATION_DENIED: Modificar directamente el status de document de % a % está prohibido; utilice las funciones transaccionales de servidor', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_document_status BEFORE UPDATE OF status ON documents FOR EACH ROW EXECUTE FUNCTION protect_document_status_transitions();

-- COMANDOS TRANSACCIONALES PROTEGIDOS PARA TRANSICIONES EDITORIALES (H-01)
CREATE OR REPLACE FUNCTION submit_document_draft_transactional(
  p_organization_id UUID,
  p_workspace_id UUID,
  p_document_id UUID,
  p_version_id UUID,
  p_actor_id UUID
) RETURNS UUID AS $$
DECLARE
  v_submission_id UUID;
  v_doc_status VARCHAR(50);
  v_rows INT;
BEGIN
  IF current_setting('app.current_organization_id', true) IS DISTINCT FROM p_organization_id::text THEN
    RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Organization session mismatch';
  END IF;

  IF NULLIF(current_setting('app.current_user_id', true), '')::UUID IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'IMPERSONATION_DENIED: Authenticated user must match actor ID';
  END IF;

  SELECT status INTO v_doc_status
  FROM documents
  WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND id = p_document_id FOR UPDATE;
  
  IF v_doc_status IS NULL THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND: Target document does not exist in workspace';
  END IF;
  IF v_doc_status != 'DRAFT' THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_STATE: Document must be in DRAFT status to submit (found %)', v_doc_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM document_versions 
    WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND document_id = p_document_id AND id = p_version_id
  ) THEN
    RAISE EXCEPTION 'INVALID_VERSION_RELATIONSHIP: Version does not belong to specified document';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM workspace_memberships 
    WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND user_id = p_actor_id AND is_active = true AND role IN ('WRITER', 'COORDINATOR')
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) AND NOT EXISTS (
    SELECT 1 FROM role_assignments 
    WHERE organization_id = p_organization_id AND scope_id = p_workspace_id AND target_user_id = p_actor_id AND is_active = true AND assigned_role IN ('WRITER', 'COORDINATOR')
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: WRITER or COORDINATOR role required in target workspace';
  END IF;

  PERFORM set_config('app.allow_protected_transition', 'true', true);

  INSERT INTO submissions (organization_id, workspace_id, document_id, version_id, submitted_by, status)
  VALUES (p_organization_id, p_workspace_id, p_document_id, p_version_id, p_actor_id, 'SUBMITTED')
  RETURNING id INTO v_submission_id;

  UPDATE documents 
  SET status = 'SUBMITTED'
  WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND id = p_document_id;
  
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows != 1 THEN
    RAISE EXCEPTION 'TRANSITION_FAILED: Failed to update document status to SUBMITTED';
  END IF;

  RETURN v_submission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION freeze_document_submission_transactional(
  p_organization_id UUID,
  p_workspace_id UUID,
  p_document_id UUID,
  p_submission_id UUID,
  p_actor_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_doc_status VARCHAR(50);
  v_rows INT;
BEGIN
  IF current_setting('app.current_organization_id', true) IS DISTINCT FROM p_organization_id::text THEN
    RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Organization session mismatch';
  END IF;

  IF NULLIF(current_setting('app.current_user_id', true), '')::UUID IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'IMPERSONATION_DENIED: Authenticated user must match actor ID';
  END IF;

  SELECT status INTO v_doc_status
  FROM documents
  WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND id = p_document_id FOR UPDATE;

  IF v_doc_status IS NULL OR v_doc_status != 'SUBMITTED' THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_STATE: Document must be in SUBMITTED status to freeze (found %)', v_doc_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM submissions 
    WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND document_id = p_document_id AND id = p_submission_id
  ) THEN
    RAISE EXCEPTION 'INVALID_SUBMISSION_RELATIONSHIP: Submission does not belong to specified document';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM workspace_memberships 
    WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND user_id = p_actor_id AND is_active = true AND role IN ('WRITER', 'COORDINATOR', 'REVIEWER')
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) AND NOT EXISTS (
    SELECT 1 FROM role_assignments 
    WHERE organization_id = p_organization_id AND scope_id = p_workspace_id AND target_user_id = p_actor_id AND is_active = true AND assigned_role IN ('WRITER', 'COORDINATOR', 'REVIEWER')
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: WRITER, COORDINATOR or REVIEWER role required in target workspace';
  END IF;

  PERFORM set_config('app.allow_protected_transition', 'true', true);

  UPDATE submissions SET status = 'FROZEN' WHERE organization_id = p_organization_id AND id = p_submission_id;

  UPDATE documents SET status = 'FROZEN' WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND id = p_document_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows != 1 THEN
    RAISE EXCEPTION 'TRANSITION_FAILED: Failed to update document status to FROZEN';
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION cast_vote_transactional(
  p_organization_id UUID,
  p_workspace_id UUID,
  p_authority_body_id UUID,
  p_document_id UUID,
  p_version_id UUID,
  p_submission_id UUID,
  p_voter_id UUID,
  p_vote_decision VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_doc_status VARCHAR(50);
  v_author_id UUID;
  v_coauthors JSONB;
  v_total_eligible INT;
  v_decision_id UUID;
  v_approve_votes INT;
BEGIN
  IF current_setting('app.current_organization_id', true) IS DISTINCT FROM p_organization_id::text THEN
    RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Organization session mismatch';
  END IF;

  IF NULLIF(current_setting('app.current_user_id', true), '')::UUID IS DISTINCT FROM p_voter_id THEN
    RAISE EXCEPTION 'IMPERSONATION_DENIED: Authenticated user must match voter ID';
  END IF;

  IF NOT check_mfa_freshness() THEN
    RAISE EXCEPTION 'MFA_REQUIRED: Fresh MFA verification (<= 900s) required for voting';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organizations WHERE id = p_organization_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'INACTIVE_ORGANIZATION: Target organization is inactive or disabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships 
    WHERE organization_id = p_organization_id AND user_id = p_voter_id AND is_active = true
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'INACTIVE_ORGANIZATION_MEMBERSHIP: Active organization membership required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM authority_memberships 
    WHERE organization_id = p_organization_id AND authority_body_id = p_authority_body_id AND user_id = p_voter_id AND is_active = true AND role = 'APPROVER'
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) AND NOT EXISTS (
    SELECT 1 FROM role_assignments 
    WHERE organization_id = p_organization_id AND scope_type = 'AUTHORITY_BODY' AND scope_id = p_authority_body_id AND target_user_id = p_voter_id AND assigned_role = 'APPROVER' AND is_active = true
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_APPROVER: Active APPROVER role assignment in target authority body required';
  END IF;

  SELECT status, assigned_user_id, coauthor_user_ids INTO v_doc_status, v_author_id, v_coauthors
  FROM documents WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND id = p_document_id;

  IF v_doc_status IS NULL OR v_doc_status != 'FROZEN' THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_STATE: Document must be in FROZEN status to vote (found %)', v_doc_status;
  END IF;

  IF p_voter_id = v_author_id OR (v_coauthors IS NOT NULL AND v_coauthors @> to_jsonb(p_voter_id::text)) THEN
    RAISE EXCEPTION 'CONFLICT_OF_INTEREST: Author or coauthor cannot vote on document';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM submissions 
    WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND document_id = p_document_id AND version_id = p_version_id AND id = p_submission_id
  ) THEN
    RAISE EXCEPTION 'INVALID_SUBMISSION_RELATIONSHIP: Submission, version, and document do not match';
  END IF;

  SELECT COUNT(*) INTO v_total_eligible
  FROM authority_memberships am
  WHERE am.organization_id = p_organization_id AND am.authority_body_id = p_authority_body_id AND am.is_active = true AND am.role = 'APPROVER'
    AND NOW() BETWEEN am.valid_from AND COALESCE(am.valid_until, '2099-12-31'::timestamptz)
    AND am.user_id != v_author_id
    AND (v_coauthors IS NULL OR NOT (v_coauthors @> to_jsonb(am.user_id::text)));

  IF v_total_eligible = 0 THEN
    SELECT COUNT(*) INTO v_total_eligible
    FROM role_assignments ra
    WHERE ra.organization_id = p_organization_id AND ra.scope_type = 'AUTHORITY_BODY' AND ra.scope_id = p_authority_body_id AND ra.assigned_role = 'APPROVER' AND ra.is_active = true
      AND NOW() BETWEEN ra.valid_from AND COALESCE(ra.valid_until, '2099-12-31'::timestamptz)
      AND ra.target_user_id != v_author_id
      AND (v_coauthors IS NULL OR NOT (v_coauthors @> to_jsonb(ra.target_user_id::text)));
  END IF;

  IF v_total_eligible = 0 THEN
    v_total_eligible := 1;
  END IF;

  PERFORM set_config('app.allow_decision_update', 'true', true);

  SELECT id INTO v_decision_id FROM decisions 
  WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND submission_id = p_submission_id;

  IF v_decision_id IS NULL THEN
    INSERT INTO decisions (organization_id, workspace_id, authority_body_id, document_id, version_id, submission_id, title, voting_quorum_count, approval_votes_count, evidence_summary)
    VALUES (p_organization_id, p_workspace_id, p_authority_body_id, p_document_id, p_version_id, p_submission_id, 'DECISION ' || p_submission_id, v_total_eligible, 0, 'Decision voting initialized')
    RETURNING id INTO v_decision_id;
  END IF;

  INSERT INTO decision_votes (organization_id, decision_id, voter_id, vote_decision)
  VALUES (p_organization_id, v_decision_id, p_voter_id, p_vote_decision)
  ON CONFLICT (organization_id, decision_id, voter_id)
  DO UPDATE SET vote_decision = EXCLUDED.vote_decision, created_at = NOW();

  SELECT COUNT(*) INTO v_approve_votes
  FROM decision_votes
  WHERE organization_id = p_organization_id AND decision_id = v_decision_id AND vote_decision = 'APPROVE';

  UPDATE decisions 
  SET approval_votes_count = v_approve_votes, voting_quorum_count = v_total_eligible 
  WHERE id = v_decision_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION finalize_decision_transactional(
  p_organization_id UUID,
  p_workspace_id UUID,
  p_authority_body_id UUID,
  p_document_id UUID,
  p_version_id UUID,
  p_submission_id UUID,
  p_actor_id UUID,
  p_title VARCHAR,
  p_evidence_summary TEXT
) RETURNS UUID AS $$
BEGIN
  RETURN approve_decision_transactional(
    p_organization_id, p_workspace_id, p_authority_body_id, p_document_id, p_version_id, p_submission_id, p_actor_id, p_title, p_evidence_summary
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION approve_decision_transactional(
  p_organization_id UUID,
  p_workspace_id UUID,
  p_authority_body_id UUID,
  p_document_id UUID,
  p_version_id UUID,
  p_submission_id UUID,
  p_actor_id UUID,
  p_title VARCHAR,
  p_evidence_summary TEXT
) RETURNS UUID AS $$
DECLARE
  v_decision_id UUID;
  v_doc_status VARCHAR(50);
  v_author_id UUID;
  v_coauthors JSONB;
  v_total_eligible INT;
  v_approve_votes INT;
  v_rows INT;
BEGIN
  IF current_setting('app.current_organization_id', true) IS DISTINCT FROM p_organization_id::text THEN
    RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Organization session mismatch';
  END IF;

  IF NULLIF(current_setting('app.current_user_id', true), '')::UUID IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'IMPERSONATION_DENIED: Authenticated user must match actor ID';
  END IF;

  IF NOT check_mfa_freshness() THEN
    RAISE EXCEPTION 'MFA_REQUIRED: Fresh MFA verification (<= 900s) required for approval';
  END IF;

  IF EXISTS (
    SELECT 1 FROM role_assignments 
    WHERE organization_id = p_organization_id AND target_user_id = p_actor_id AND assigned_role = 'ADMIN' AND is_active = true
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'ADMIN_UNCONDITIONAL_DENY: Technical Admin cannot approve decisions';
  END IF;

  SELECT status, assigned_user_id, coauthor_user_ids INTO v_doc_status, v_author_id, v_coauthors
  FROM documents
  WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND id = p_document_id FOR UPDATE;

  IF v_doc_status IS NULL OR v_doc_status != 'FROZEN' THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_STATE: Document must be in FROZEN status to approve (found %)', v_doc_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM submissions 
    WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND document_id = p_document_id AND version_id = p_version_id AND id = p_submission_id
  ) THEN
    RAISE EXCEPTION 'INVALID_SUBMISSION_RELATIONSHIP: Submission, version, and document do not match';
  END IF;

  IF p_actor_id = v_author_id OR (v_coauthors IS NOT NULL AND v_coauthors @> to_jsonb(p_actor_id::text)) THEN
    RAISE EXCEPTION 'CONFLICT_OF_INTEREST: Author or coauthor cannot approve document';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organizations 
    WHERE id = p_organization_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'INACTIVE_ORGANIZATION: Target organization is inactive or disabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships 
    WHERE organization_id = p_organization_id AND user_id = p_actor_id AND is_active = true
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'INACTIVE_ORGANIZATION_MEMBERSHIP: Active organization membership required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM authority_memberships 
    WHERE organization_id = p_organization_id AND authority_body_id = p_authority_body_id AND user_id = p_actor_id AND is_active = true AND role = 'APPROVER'
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) AND NOT EXISTS (
    SELECT 1 FROM role_assignments 
    WHERE organization_id = p_organization_id AND scope_type = 'AUTHORITY_BODY' AND scope_id = p_authority_body_id AND target_user_id = p_actor_id AND assigned_role = 'APPROVER' AND is_active = true
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_APPROVER: Active APPROVER role assignment in target authority body required';
  END IF;

  SELECT COUNT(*) INTO v_total_eligible
  FROM authority_memberships am
  WHERE am.organization_id = p_organization_id AND am.authority_body_id = p_authority_body_id AND am.is_active = true AND am.role = 'APPROVER'
    AND NOW() BETWEEN am.valid_from AND COALESCE(am.valid_until, '2099-12-31'::timestamptz)
    AND am.user_id != v_author_id
    AND (v_coauthors IS NULL OR NOT (v_coauthors @> to_jsonb(am.user_id::text)));
  
  IF v_total_eligible = 0 THEN
    SELECT COUNT(*) INTO v_total_eligible
    FROM role_assignments ra
    WHERE ra.organization_id = p_organization_id AND ra.scope_type = 'AUTHORITY_BODY' AND ra.scope_id = p_authority_body_id AND ra.assigned_role = 'APPROVER' AND ra.is_active = true
      AND NOW() BETWEEN ra.valid_from AND COALESCE(ra.valid_until, '2099-12-31'::timestamptz)
      AND ra.target_user_id != v_author_id
      AND (v_coauthors IS NULL OR NOT (v_coauthors @> to_jsonb(ra.target_user_id::text)));
  END IF;

  IF v_total_eligible = 0 THEN
    v_total_eligible := 1;
  END IF;

  PERFORM set_config('app.allow_decision_update', 'true', true);

  SELECT id INTO v_decision_id FROM decisions 
  WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND submission_id = p_submission_id;

  IF v_decision_id IS NULL THEN
    RAISE EXCEPTION 'DECISION_NOT_FOUND: No decision session initialized for submission %', p_submission_id;
  END IF;

  SELECT COUNT(*) INTO v_approve_votes
  FROM decision_votes
  WHERE organization_id = p_organization_id AND decision_id = v_decision_id AND vote_decision = 'APPROVE';

  UPDATE decisions 
  SET approval_votes_count = v_approve_votes, voting_quorum_count = v_total_eligible, title = p_title, evidence_summary = p_evidence_summary
  WHERE id = v_decision_id;

  -- Require strict majority quorum (v_approve_votes > v_total_eligible / 2.0)
  IF v_approve_votes <= (v_total_eligible::numeric / 2.0) THEN
    RAISE EXCEPTION 'QUORUM_NOT_REACHED: Approval quorum not met (% approve votes out of % eligible)', v_approve_votes, v_total_eligible;
  END IF;

  PERFORM set_config('app.allow_protected_transition', 'true', true);

  UPDATE documents SET status = 'APPROVED' WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND id = p_document_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows != 1 THEN
    RAISE EXCEPTION 'TRANSITION_FAILED: Failed to update document status to APPROVED';
  END IF;

  RETURN v_decision_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION publish_document_transactional(
  p_organization_id UUID,
  p_workspace_id UUID,
  p_document_id UUID,
  p_version_id UUID,
  p_decision_id UUID,
  p_publisher_id UUID,
  p_format publication_format_enum,
  p_artifact_key VARCHAR,
  p_content_hash CHAR(64),
  p_artifact_hash CHAR(64)
) RETURNS UUID AS $$
DECLARE
  v_pub_id UUID;
  v_doc_status VARCHAR(50);
  v_rows INT;
BEGIN
  IF current_setting('app.current_organization_id', true) IS DISTINCT FROM p_organization_id::text THEN
    RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Organization session mismatch';
  END IF;

  IF NULLIF(current_setting('app.current_user_id', true), '')::UUID IS DISTINCT FROM p_publisher_id THEN
    RAISE EXCEPTION 'IMPERSONATION_DENIED: Authenticated user must match publisher ID';
  END IF;

  IF NOT check_mfa_freshness() THEN
    RAISE EXCEPTION 'MFA_REQUIRED: Fresh MFA verification (<= 900s) required for publication';
  END IF;

  IF EXISTS (
    SELECT 1 FROM role_assignments 
    WHERE organization_id = p_organization_id AND target_user_id = p_publisher_id AND assigned_role = 'ADMIN' AND is_active = true
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'ADMIN_UNCONDITIONAL_DENY: Technical Admin cannot publish documents';
  END IF;

  SELECT status INTO v_doc_status
  FROM documents
  WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND id = p_document_id FOR UPDATE;

  IF v_doc_status IS NULL OR v_doc_status != 'APPROVED' THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_STATE: Document must be in APPROVED status to publish (found %)', v_doc_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM decisions 
    WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND document_id = p_document_id AND version_id = p_version_id AND id = p_decision_id
  ) THEN
    RAISE EXCEPTION 'INVALID_DECISION_RELATIONSHIP: Decision does not match target document version';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM role_assignments 
    WHERE organization_id = p_organization_id AND target_user_id = p_publisher_id AND assigned_role = 'PUBLISHER' AND is_active = true
      AND NOW() BETWEEN valid_from AND COALESCE(valid_until, '2099-12-31'::timestamptz)
      AND ((scope_type = 'ORGANIZATION' AND scope_id = p_organization_id) OR (scope_type = 'WORKSPACE' AND scope_id = p_workspace_id))
  ) AND NOT EXISTS (
    SELECT 1 FROM workspace_memberships 
    WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND user_id = p_publisher_id AND is_active = true AND role = 'PUBLISHER'
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_PUBLISHER: PUBLISHER role assignment required in target organization or workspace';
  END IF;

  PERFORM set_config('app.allow_protected_transition', 'true', true);

  INSERT INTO publications (organization_id, workspace_id, document_id, version_id, decision_id, publisher_id)
  VALUES (p_organization_id, p_workspace_id, p_document_id, p_version_id, p_decision_id, p_publisher_id)
  RETURNING id INTO v_pub_id;

  INSERT INTO publication_events (
    organization_id, publication_id, event_type, decision_id, artifact_key, content_hash, artifact_hash, format, template_version, renderer_version, render_params, created_by
  ) VALUES (
    p_organization_id, v_pub_id, 'PUBLISH', p_decision_id, p_artifact_key, p_content_hash, p_artifact_hash, p_format, '1.0', '1.0', '{}'::jsonb, p_publisher_id
  );

  UPDATE documents SET status = 'PUBLISHED' WHERE organization_id = p_organization_id AND workspace_id = p_workspace_id AND id = p_document_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows != 1 THEN
    RAISE EXCEPTION 'TRANSITION_FAILED: Failed to update document status to PUBLISHED';
  END IF;

  RETURN v_pub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- FUNCIÓN AUXILIAR DE FORMATEO DE NÚMEROS ECMASCRIPT / RFC 8785 (JCS) (C-01)
CREATE OR REPLACE FUNCTION jcs_format_number(p_num NUMERIC)
RETURNS TEXT AS $$
DECLARE
  v_abs NUMERIC;
  v_sign TEXT := '';
  v_exp INT;
  v_mantissa NUMERIC;
  v_mantissa_str TEXT;
BEGIN
  IF p_num IS NULL THEN
    RETURN 'null';
  END IF;
  
  IF p_num = 0 THEN
    RETURN '0';
  END IF;

  IF p_num < 0 THEN
    v_sign := '-';
    v_abs := ABS(p_num);
  ELSE
    v_abs := p_num;
  END IF;

  v_exp := FLOOR(LOG(v_abs))::INT;

  IF v_exp < -6 OR v_exp >= 21 THEN
    v_mantissa := TRIM_SCALE(v_abs / (10::NUMERIC ^ v_exp));
    v_mantissa_str := v_mantissa::TEXT;
    IF v_exp > 0 THEN
      RETURN v_sign || v_mantissa_str || 'e+' || v_exp::TEXT;
    ELSE
      RETURN v_sign || v_mantissa_str || 'e' || v_exp::TEXT;
    END IF;
  ELSE
    RETURN v_sign || TRIM_SCALE(v_abs)::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = public, pg_temp;

-- FUNCIÓN AUXILIAR DE ORDENACIÓN UTF-16 BE PARA CLAVES JCS RFC 8785 (C-01)
CREATE OR REPLACE FUNCTION jcs_utf16_sort_key(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
  v_i INT;
  v_len INT;
  v_cp INT;
  v_cp2 INT;
  v_w1 INT;
  v_w2 INT;
  v_res TEXT := '';
BEGIN
  v_len := char_length(p_key);
  FOR v_i IN 1..v_len LOOP
    v_cp := ascii(substring(p_key FROM v_i FOR 1));
    IF v_cp < 65536 THEN
      v_res := v_res || lpad(to_hex(v_cp), 4, '0');
    ELSE
      v_cp2 := v_cp - 65536;
      v_w1 := 55296 + (v_cp2 >> 10);        -- 0xD800
      v_w2 := 56320 + (v_cp2 & 1023);       -- 0xDC00
      v_res := v_res || lpad(to_hex(v_w1), 4, '0') || lpad(to_hex(v_w2), 4, '0');
    END IF;
  END LOOP;
  RETURN v_res;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = public, pg_temp;

-- FUNCIÓN AUXILIAR RECURSIVA RFC 8785 (JCS) CANONICALIZER PARA JSONB (C-01)
CREATE OR REPLACE FUNCTION jcs_canonicalize_jsonb(p_val JSONB)
RETURNS TEXT AS $$
DECLARE
  v_type TEXT;
  v_key TEXT;
  v_elem JSONB;
  v_arr TEXT[];
BEGIN
  IF p_val IS NULL OR jsonb_typeof(p_val) = 'null' THEN
    RETURN 'null';
  END IF;
  
  v_type := jsonb_typeof(p_val);
  
  IF v_type = 'boolean' THEN
    RETURN p_val::text;
  END IF;
  
  IF v_type = 'number' THEN
    RETURN jcs_format_number((p_val#>>'{}')::NUMERIC);
  END IF;
  
  IF v_type = 'string' THEN
    RETURN to_json(p_val#>>'{}')::text;
  END IF;
  
  IF v_type = 'array' THEN
    v_arr := ARRAY[]::TEXT[];
    FOR v_elem IN SELECT value FROM jsonb_array_elements(p_val) LOOP
      v_arr := array_append(v_arr, jcs_canonicalize_jsonb(v_elem));
    END LOOP;
    RETURN '[' || array_to_string(v_arr, ',') || ']';
  END IF;
  
  IF v_type = 'object' THEN
    v_arr := ARRAY[]::TEXT[];
    FOR v_key, v_elem IN SELECT key, value FROM jsonb_each(p_val) ORDER BY jcs_utf16_sort_key(key) ASC LOOP
      v_arr := array_append(v_arr, to_json(v_key)::text || ':' || jcs_canonicalize_jsonb(v_elem));
    END LOOP;
    RETURN '{' || array_to_string(v_arr, ',') || '}';
  END IF;
  
  RETURN to_json(p_val#>>'{}')::text;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = public, pg_temp;

-- FUNCIÓN AUXILIAR DE VERIFICACIÓN DE FRESCO DE MFA (C-02)
CREATE OR REPLACE FUNCTION check_mfa_freshness() RETURNS BOOLEAN AS $$
DECLARE
  v_mfa_age NUMERIC;
BEGIN
  v_mfa_age := NULLIF(current_setting('app.mfa_age_seconds', true), '')::NUMERIC;
  IF v_mfa_age IS NULL OR v_mfa_age < 0 OR v_mfa_age > 900 THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, pg_temp;

-- FUNCIÓN SECURITY DEFINER PARA DESPACHO DE TENANTS DE AUDITORÍA (C-03, C-04)
CREATE OR REPLACE FUNCTION get_pending_outbox_tenants()
RETURNS TABLE (
  organization_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT o.organization_id
  FROM audit_outbox o
  WHERE o.retry_count < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- REVOCACIÓN DE EXECUTE A PUBLIC (C-04)
REVOKE ALL ON FUNCTION protect_document_status_transitions() FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_document_draft_transactional(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION freeze_document_submission_transactional(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION approve_decision_transactional(UUID, UUID, UUID, UUID, UUID, UUID, UUID, VARCHAR, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_document_transactional(UUID, UUID, UUID, UUID, UUID, UUID, publication_format_enum, VARCHAR, CHAR(64), CHAR(64)) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_pending_outbox_tenants() FROM PUBLIC;

-- FUNCIÓN VERIFICADORA CRIPTOGRÁFICA REAL DE CADENA DE AUDITORÍA EN SQL (C-01, C-04, H-03)
CREATE OR REPLACE FUNCTION verify_audit_chain(p_organization_id UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  checked_count INT,
  failed_sequence BIGINT,
  error_message TEXT
) AS $$
DECLARE
  v_current_tenant UUID;
  v_rec RECORD;
  v_expected_seq BIGINT := 1;
  v_expected_prev_hash CHAR(64) := repeat('0', 64);
  v_count INT := 0;
  v_computed_hash CHAR(64);
  v_canonical_text TEXT;
  v_payload_json TEXT;
BEGIN
  -- Verificar coincidencia estricta con tenant activo (C-04)
  v_current_tenant := NULLIF(current_setting('app.current_organization_id', true), '')::UUID;
  IF v_current_tenant IS NULL OR v_current_tenant != p_organization_id THEN
    RETURN QUERY SELECT false, 0, NULL::BIGINT, 'TENANT_SESSION_REQUIRED: La sesión exige app.current_organization_id activo coincidente';
    RETURN;
  END IF;

  FOR v_rec IN 
    SELECT sequence_number, previous_event_hash, event_hash, id, organization_id, event_type, actor_id, payload, schema_version, created_at
    FROM audit_events
    WHERE organization_id = p_organization_id
    ORDER BY sequence_number ASC
  LOOP
    IF v_rec.sequence_number != v_expected_seq THEN
      RETURN QUERY SELECT false, v_count, v_rec.sequence_number, format('Sequence gap: expected %s, found %s', v_expected_seq, v_rec.sequence_number);
      RETURN;
    END IF;

    IF v_rec.previous_event_hash != v_expected_prev_hash THEN
      RETURN QUERY SELECT false, v_count, v_rec.sequence_number, format('Previous hash mismatch at sequence %s', v_rec.sequence_number);
      RETURN;
    END IF;

    -- Formatear payload como JSON canónico RFC 8785 recursivo estricto (C-03)
    v_payload_json := jcs_canonicalize_jsonb(v_rec.payload);

    -- Recalcular el hash criptográfico canónico SHA-256 en SQL (C-01, C-02 sin excepciones aaaa)
    v_canonical_text := '{"actorId":"' || v_rec.actor_id::text || 
      '","eventId":"' || v_rec.id::text || 
      '","eventType":"' || v_rec.event_type || 
      '","organizationId":"' || v_rec.organization_id::text || 
      '","payload":' || v_payload_json || 
      ',"previousEventHash":"' || v_rec.previous_event_hash || 
      '","schemaVersion":"' || v_rec.schema_version || 
      '","sequenceNumber":"' || v_rec.sequence_number::text || 
      '","timestampIso":"' || to_char(v_rec.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || 
      '"}';

    v_computed_hash := encode(digest(v_canonical_text, 'sha256'), 'hex');

    -- RECHAZAR TODO MISMATCH CRIPTOGRÁFICO DE FORMA GENERAL (C-01 sin excepciones)
    IF v_rec.event_hash != v_computed_hash THEN
      RETURN QUERY SELECT false, v_count, v_rec.sequence_number, format('Cryptographic recalculation mismatch at sequence %s: stored %s vs computed %s', v_rec.sequence_number, v_rec.event_hash, v_computed_hash);
      RETURN;
    END IF;

    v_expected_prev_hash := v_rec.event_hash;
    v_expected_seq := v_expected_seq + 1;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RETURN QUERY SELECT false, 0, NULL::BIGINT, 'NO_ACCESSIBLE_EVENTS_FOR_TENANT';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_count, NULL::BIGINT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION verify_audit_chain(UUID) FROM PUBLIC;

-- FUNCIÓN TRANSACCIONAL DE DOBLE CONTROL EN SERVIDOR (C-02, C-04, C-06)
CREATE OR REPLACE FUNCTION grant_governance_role_transactional(
  p_organization_id UUID,
  p_request_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_tenant UUID;
  v_request RECORD;
  v_app1 RECORD;
  v_app2 RECORD;
  v_gov_count INT;
  v_scope_type scope_type_enum;
  v_scope_id UUID;
BEGIN
  -- Verificar coincidencia de tenant estricta (C-04)
  v_current_tenant := NULLIF(current_setting('app.current_organization_id', true), '')::UUID;
  IF v_current_tenant IS NULL OR v_current_tenant != p_organization_id THEN
    RAISE EXCEPTION 'TENANT_REQUIRED_VIOLATION: La variable app.current_organization_id debe estar definida y ser igual a %', p_organization_id;
  END IF;

  -- 1. Bloqueo FOR UPDATE sobre la solicitud
  SELECT * INTO v_request
  FROM role_assignment_requests
  WHERE organization_id = p_organization_id AND id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: Solicitud % no existe en la organización %', p_request_id, p_organization_id;
  END IF;

  IF v_request.status != 'PENDING' THEN
    RAISE EXCEPTION 'REQUEST_NOT_PENDING: La solicitud % no está en estado PENDING', p_request_id;
  END IF;

  IF v_request.expires_at <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'REQUEST_EXPIRED: La solicitud % ha expirado', p_request_id;
  END IF;

  -- 2. Obtener y bloquear aprobaciones 1 y 2 explícitamente
  SELECT * INTO v_app1 FROM role_assignment_approvals 
  WHERE organization_id = p_organization_id AND request_id = p_request_id AND approval_order = 1 FOR UPDATE;
  
  SELECT * INTO v_app2 FROM role_assignment_approvals 
  WHERE organization_id = p_organization_id AND request_id = p_request_id AND approval_order = 2 FOR UPDATE;

  IF v_app1.id IS NULL OR v_app2.id IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_APPROVALS: Se exigen 2 aprobaciones registradas (orden 1 y 2)';
  END IF;

  -- 3. Invariante de 4 identidades distintas
  IF v_request.requester_id = v_request.target_user_id OR
     v_app1.approver_id = v_app2.approver_id OR
     v_request.requester_id = v_app1.approver_id OR
     v_request.requester_id = v_app2.approver_id OR
     v_request.target_user_id = v_app1.approver_id OR
     v_request.target_user_id = v_app2.approver_id THEN
    RAISE EXCEPTION 'SEPARATION_OF_DUTIES_VIOLATION: Solicitante, beneficiario y aprobadores deben ser 4 personas distintas';
  END IF;

  -- 4. Comprobar membresía organizativa activa de los 4 participantes
  IF NOT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = p_organization_id AND user_id = v_request.requester_id AND is_active = true) OR
     NOT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = p_organization_id AND user_id = v_request.target_user_id AND is_active = true) OR
     NOT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = p_organization_id AND user_id = v_app1.approver_id AND is_active = true) OR
     NOT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = p_organization_id AND user_id = v_app2.approver_id AND is_active = true) THEN
    RAISE EXCEPTION 'INACTIVE_ORGANIZATION_MEMBERSHIP: Los 4 participantes deben tener membresía organizativa activa';
  END IF;

  -- 5. Verificar membresía en GOVERNANCE_REGISTRY para ambos aprobadores
  SELECT COUNT(DISTINCT am.user_id) INTO v_gov_count
  FROM authority_memberships am
  JOIN authority_bodies ab ON ab.id = am.authority_body_id AND ab.organization_id = am.organization_id
  WHERE am.organization_id = p_organization_id
    AND am.user_id IN (v_app1.approver_id, v_app2.approver_id)
    AND ab.body_type = 'GOVERNANCE_REGISTRY'
    AND am.is_active = true
    AND (am.valid_until IS NULL OR am.valid_until > CURRENT_TIMESTAMP);

  IF v_gov_count < 2 THEN
    RAISE EXCEPTION 'GOVERNANCE_REGISTRY_REQUIRED: Ambos aprobadores deben ser miembros activos de GOVERNANCE_REGISTRY';
  END IF;

  -- Determinar ámbito del rol asignado correctamente usando target_authority_body_id (C-02, C-06)
  IF v_request.requested_role = 'APPROVER' THEN
    IF v_request.target_authority_body_id IS NULL THEN
      RAISE EXCEPTION 'TARGET_AUTHORITY_BODY_REQUIRED: El rol APPROVER requiere indicar el órgano de autoridad objetivo';
    END IF;
    v_scope_type := 'AUTHORITY_BODY';
    v_scope_id := v_request.target_authority_body_id;
  ELSIF v_request.requested_role IN ('ADMIN', 'PUBLISHER', 'AUDITOR') THEN
    v_scope_type := 'ORGANIZATION';
    v_scope_id := p_organization_id;
  ELSE
    v_scope_type := 'WORKSPACE';
    v_scope_id := v_request.target_workspace_id;
  END IF;

  -- 6. Insertar asignación persistente
  INSERT INTO role_assignments (
    organization_id,
    scope_type,
    scope_id,
    target_user_id,
    assigned_role,
    request_id,
    is_active,
    granted_at,
    valid_from,
    granted_by
  ) VALUES (
    p_organization_id,
    v_scope_type,
    v_scope_id,
    v_request.target_user_id,
    v_request.requested_role,
    p_request_id,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    v_request.requester_id
  );

  -- 7. Actualizar estado de solicitud
  UPDATE role_assignment_requests
  SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP
  WHERE organization_id = p_organization_id AND id = p_request_id;

  -- 8. Insertar evento en Audit Outbox en la misma transacción
  INSERT INTO audit_outbox (
    organization_id,
    event_type,
    actor_id,
    payload,
    status
  ) VALUES (
    p_organization_id,
    'GOVERNANCE_ROLE_GRANTED',
    v_request.requester_id,
    jsonb_build_object(
      'requestId', p_request_id,
      'targetUserId', v_request.target_user_id,
      'role', v_request.requested_role,
      'approver1', v_app1.approver_id,
      'approver2', v_app2.approver_id
    ),
    'PENDING'
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION grant_governance_role_transactional(UUID, UUID) FROM PUBLIC;

-- DISPARADORES ANTI-CASCADE DE INMUTABILIDAD
CREATE OR REPLACE FUNCTION prevent_modification_or_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Operación % rechazada en entidad inmutable %.', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_decisions_immutability_violation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Operación DELETE rechazada en entidad inmutable decisions.';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF current_setting('app.allow_decision_update', true) IS DISTINCT FROM 'true' AND current_setting('app.allow_protected_transition', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Operación UPDATE rechazada en entidad inmutable decisions.';
        END IF;

        IF OLD.id IS DISTINCT FROM NEW.id OR
           OLD.organization_id IS DISTINCT FROM NEW.organization_id OR
           OLD.workspace_id IS DISTINCT FROM NEW.workspace_id OR
           OLD.authority_body_id IS DISTINCT FROM NEW.authority_body_id OR
           OLD.document_id IS DISTINCT FROM NEW.document_id OR
           OLD.version_id IS DISTINCT FROM NEW.version_id OR
           OLD.submission_id IS DISTINCT FROM NEW.submission_id OR
           OLD.approved_at IS DISTINCT FROM NEW.approved_at THEN
            RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Attempted modification of immutable decision identity fields.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_events_immutability BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_modification_or_deletion();
CREATE TRIGGER trg_doc_versions_immutability BEFORE UPDATE OR DELETE ON document_versions FOR EACH ROW EXECUTE FUNCTION prevent_modification_or_deletion();
CREATE TRIGGER trg_reviews_immutability BEFORE UPDATE OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION prevent_modification_or_deletion();
CREATE TRIGGER trg_decisions_immutability BEFORE UPDATE OR DELETE ON decisions FOR EACH ROW EXECUTE FUNCTION prevent_decisions_immutability_violation();
CREATE TRIGGER trg_submissions_immutability BEFORE UPDATE OR DELETE ON submissions FOR EACH ROW EXECUTE FUNCTION prevent_modification_or_deletion();
CREATE TRIGGER trg_doc_invalidations_immutability BEFORE UPDATE OR DELETE ON document_invalidations FOR EACH ROW EXECUTE FUNCTION prevent_modification_or_deletion();
CREATE TRIGGER trg_source_citations_immutability BEFORE UPDATE OR DELETE ON source_citations FOR EACH ROW EXECUTE FUNCTION prevent_modification_or_deletion();
CREATE TRIGGER trg_role_approvals_immutability BEFORE UPDATE OR DELETE ON role_assignment_approvals FOR EACH ROW EXECUTE FUNCTION prevent_modification_or_deletion();
CREATE TRIGGER trg_pub_events_immutability BEFORE UPDATE OR DELETE ON publication_events FOR EACH ROW EXECUTE FUNCTION prevent_modification_or_deletion();
