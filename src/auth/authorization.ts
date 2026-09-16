export type ClassificationLevel = 'PUBLICO' | 'INTERNO' | 'CONFIDENCIAL' | 'RESTRINGIDO';
export type ResourceState = 'DRAFT' | 'SUBMITTED' | 'FROZEN' | 'APPROVED' | 'PUBLISHED';
export type PublicationState = 'ACTIVE' | 'WITHDRAWN' | 'REPLACED';

export type ActionType = 
  | 'READ' 
  | 'CREATE_DRAFT' 
  | 'EDIT' 
  | 'DELETE_DRAFT' 
  | 'SUBMIT_FOR_REVIEW' 
  | 'ISSUE_REVIEW' 
  | 'APPROVE_DECISION' 
  | 'PUBLISH' 
  | 'EMERGENCY_UNPUBLISH' 
  | 'ASSIGN_GOVERNANCE_ROLE' 
  | 'AUDIT_READ';

export type UserRole = 
  | 'ADMIN' 
  | 'COORDINATOR' 
  | 'WRITER' 
  | 'REVIEWER' 
  | 'APPROVER' 
  | 'PUBLISHER' 
  | 'AUDITOR';

export type ScopeType = 'ORGANIZATION' | 'WORKSPACE' | 'AUTHORITY_BODY';

export interface EffectiveRoleAssignment {
  id: string;
  organizationId: string;
  scopeType: ScopeType;
  scopeId: string;
  assignedRole: UserRole;
  role?: UserRole;
  isActive: boolean;
  validFrom: string;
  validUntil?: string;
}

export interface ResolvedAuthorizationContext {
  userId: string | null;
  isAnonymous: boolean;
  activeOrganizationId: string | null;
  activeWorkspaceId?: string;
  roles: UserRole[];
  organizationMemberships: Array<{ 
    organizationId: string; 
    isActive: boolean; 
    validFrom?: string; 
    validUntil?: string; 
  }>;
  workspaceMemberships: Array<{ 
    organizationId: string; 
    workspaceId: string; 
    role: UserRole; 
    isActive: boolean; 
    validFrom?: string; 
    validUntil?: string; 
  }>;
  authorityMemberships: Array<{ 
    organizationId: string; 
    authorityBodyId: string; 
    role: string; 
    bodyType?: string; 
    isActive: boolean; 
    validUntil?: string; 
  }>;
  effectiveRoleAssignments: EffectiveRoleAssignment[];
  mfaVerifiedAt?: string;
  mfaAgeSeconds?: number;
  specialty?: string;
  scopeTerritory?: string;
}

export interface ResourceContext {
  resourceId: string;
  organizationId: string;
  workspaceId: string;
  classification: ClassificationLevel;
  resourceState: ResourceState;
  publicationState?: PublicationState;
  assignedUserId?: string;
  coauthorUserIds?: string[];
  authorityBodyId?: string;
  specialtyRequired?: string;
  territoryScope?: string;
}

export interface AuthorizationRequest {
  action: ActionType;
  targetUserId?: string;
  requestedRole?: UserRole;
  requestId?: string;
}

export interface AuthorizationResult {
  allowed: boolean;
  grantReason?: string;
  denyReason?: string;
  requiresTransactionalExecution?: boolean;
}

export function isFiniteValidDateRange(validFrom?: string, validUntil?: string): boolean {
  const now = Date.now();
  if (validFrom) {
    const fromTs = Date.parse(validFrom);
    if (!Number.isFinite(fromTs) || fromTs > now) return false;
  }
  if (validUntil) {
    const untilTs = Date.parse(validUntil);
    if (!Number.isFinite(untilTs) || untilTs <= now) return false;
  }
  return true;
}

/**
 * Evaluador de Contrato de Autorización Causal y Multitenant (v0.2.11)
 * Satisface rigurosamente la fuente de verdad unificada y la validación de ámbitos.
 */
export function evaluateAuthorizationContract(
  context: ResolvedAuthorizationContext,
  resource: ResourceContext,
  request: AuthorizationRequest
): AuthorizationResult {
  // 1. ACCIÓN DE LECTURA PÚBLICA ANÓNIMA SEPARADA
  if (request.action === 'READ' && resource.classification === 'PUBLICO') {
    if (resource.resourceState === 'PUBLISHED' && resource.publicationState === 'ACTIVE') {
      return { allowed: true, grantReason: 'GRANT_PUBLIC_READ: Recurso público efectivamente publicado y activo' };
    }
    return { allowed: false, denyReason: 'PUBLIC_READ_UNPUBLISHED: Recurso público no se encuentra publicado y activo' };
  }

  // 2. VERIFICACIÓN DE MEMBRESÍA ORGANIZATIVA ACTIVA PARA INTRANET
  if (context.isAnonymous || !context.userId || !context.activeOrganizationId) {
    return { allowed: false, denyReason: 'UNAUTHENTICATED: Acceso a la intranet exige usuario autenticado' };
  }

  const activeOrg = context.organizationMemberships.find(
    m => m.organizationId === resource.organizationId && 
         m.isActive && 
         isFiniteValidDateRange(m.validFrom, m.validUntil)
  );
  if (!activeOrg || context.activeOrganizationId !== resource.organizationId) {
    return { allowed: false, denyReason: 'CROSS_TENANT_VIOLATION: Membresía organizativa inactiva o no coincide' };
  }

  // 3. BLOQUEO INCONDICIONAL AL ADMIN TÉCNICO (INCLUYENDO ROLES PERSISTIDOS C-02, C-05)
  const hasAdminRole = context.roles.includes('ADMIN') || context.effectiveRoleAssignments.some(
    ra => (ra.assignedRole === 'ADMIN' || ra.role === 'ADMIN') &&
         ra.organizationId === resource.organizationId &&
         ra.isActive &&
         isFiniteValidDateRange(ra.validFrom, ra.validUntil)
  );

  if (hasAdminRole) {
    if (['APPROVE_DECISION', 'PUBLISH'].includes(request.action)) {
      return { allowed: false, denyReason: 'ADMIN_UNCONDITIONAL_DENY: El Admin técnico tiene denegado aprobar o publicar' };
    }
  }

  // 4. VERIFICACIÓN MFA OBLIGATORIA CON VALIDACIÓN FINITICA
  const isGovernanceAction = ['APPROVE_DECISION', 'PUBLISH', 'EMERGENCY_UNPUBLISH', 'ASSIGN_GOVERNANCE_ROLE'].includes(request.action);
  const isSensitiveClassification = ['CONFIDENCIAL', 'RESTRINGIDO'].includes(resource.classification);
  
  if (isGovernanceAction || isSensitiveClassification) {
    if (!context.mfaVerifiedAt && context.mfaAgeSeconds === undefined) {
      return { allowed: false, denyReason: 'MFA_REQUIRED: Acción o clasificación exige verificación TOTP' };
    }
    let ageSec = context.mfaAgeSeconds;
    if (ageSec === undefined && context.mfaVerifiedAt) {
      const ts = Date.parse(context.mfaVerifiedAt);
      if (!Number.isFinite(ts)) {
        return { allowed: false, denyReason: 'MFA_INVALID_TIMESTAMP: Formato de fecha MFA no válido' };
      }
      ageSec = (Date.now() - ts) / 1000;
    }
    if (ageSec === undefined || !Number.isFinite(ageSec) || ageSec < 0 || ageSec > 900) {
      return { allowed: false, denyReason: 'MFA_EXPIRED_OR_INVALID: La verificación MFA superó los 15 minutos (900s) de tolerancia' };
    }
  }

  // 5. OBTENCIÓN DE ROL EN EL WORKSPACE ESPECÍFICO DEL RECURSO
  const wsMembership = context.workspaceMemberships.find(
    m => m.organizationId === resource.organizationId && 
         m.workspaceId === resource.workspaceId && 
         m.isActive &&
         isFiniteValidDateRange(m.validFrom, m.validUntil)
  );

  // 6. EVALUACIÓN POR ACCIÓN ESPECÍFICA

  // ACCIÓN: READ INTRANET
  if (request.action === 'READ') {
    if (!wsMembership) {
      return { allowed: false, denyReason: 'WORKSPACE_MEMBERSHIP_REQUIRED: Lectura privada exige membresía activa de workspace' };
    }
    if (resource.classification === 'INTERNO') {
      return { allowed: true, grantReason: 'GRANT_INTERNAL_READ: Miembro de workspace verificado' };
    }
    if (['CONFIDENCIAL', 'RESTRINGIDO'].includes(resource.classification)) {
      const isAuthor = resource.assignedUserId === context.userId;
      const isCoauthor = resource.coauthorUserIds?.includes(context.userId);
      if (isAuthor || isCoauthor || wsMembership.role === 'COORDINATOR') {
        return { allowed: true, grantReason: 'GRANT_RESTRICTED_READ: Autor o Coordinador de workspace' };
      }
      return { allowed: false, denyReason: 'DENY_RESTRICTED_READ: Sin asignación nominal para recurso restringido' };
    }
  }

  // ACCIÓN: CREATE_DRAFT & EDIT
  if (['CREATE_DRAFT', 'EDIT'].includes(request.action)) {
    if (!wsMembership || !['WRITER', 'COORDINATOR'].includes(wsMembership.role)) {
      return { allowed: false, denyReason: 'ROLE_REQUIRED: Requiere rol WRITER o COORDINATOR en el workspace del recurso' };
    }
    if (request.action === 'EDIT') {
      if (resource.resourceState !== 'DRAFT') {
        return { allowed: false, denyReason: 'STATE_INVALID: Edición solo permitida en estado DRAFT' };
      }
      const isAuthor = resource.assignedUserId === context.userId;
      const isCoauthor = resource.coauthorUserIds?.includes(context.userId);
      if (!isAuthor && !isCoauthor && wsMembership.role !== 'COORDINATOR') {
        return { allowed: false, denyReason: 'NOMINAL_ASSIGNMENT_REQUIRED: El usuario no es autor ni coautor del borrador' };
      }
    }
    return { allowed: true, grantReason: 'GRANT_EDIT: Permiso de edición de borrador concedido' };
  }

  // ACCIÓN: DELETE_DRAFT
  if (request.action === 'DELETE_DRAFT') {
    if (!wsMembership || !['WRITER', 'COORDINATOR'].includes(wsMembership.role)) {
      return { allowed: false, denyReason: 'ROLE_REQUIRED: Eliminación exige rol WRITER o COORDINATOR en el workspace' };
    }
    if (resource.resourceState !== 'DRAFT') {
      return { allowed: false, denyReason: 'STATE_INVALID: Eliminación solo permitida en borradores estado DRAFT' };
    }
    const isAuthor = resource.assignedUserId === context.userId;
    if (!isAuthor && wsMembership.role !== 'COORDINATOR') {
      return { allowed: false, denyReason: 'AUTHOR_OR_COORDINATOR_REQUIRED: Solo el autor o coordinador pueden eliminar el borrador' };
    }
    return { allowed: true, grantReason: 'GRANT_DELETE_DRAFT: Eliminación de borrador autorizada' };
  }

  // ACCIÓN: SUBMIT_FOR_REVIEW
  if (request.action === 'SUBMIT_FOR_REVIEW') {
    if (!wsMembership || !['WRITER', 'COORDINATOR'].includes(wsMembership.role)) {
      return { allowed: false, denyReason: 'ROLE_REQUIRED: Envío a revisión requiere rol WRITER o COORDINATOR en workspace' };
    }
    if (resource.resourceState !== 'DRAFT') {
      return { allowed: false, denyReason: 'STATE_INVALID: Envío a revisión solo permitido en borrador estado DRAFT' };
    }
    const isAuthor = resource.assignedUserId === context.userId;
    const isCoauthor = resource.coauthorUserIds?.includes(context.userId);
    if (!isAuthor && !isCoauthor && wsMembership.role !== 'COORDINATOR') {
      return { allowed: false, denyReason: 'NOMINAL_ASSIGNMENT_REQUIRED: Solo autores o coordinador pueden enviar a revisión' };
    }
    return { allowed: true, grantReason: 'GRANT_SUBMIT_REVIEW: Borrador enviado a revisión' };
  }

  // ACCIÓN: ISSUE_REVIEW (Estrictamente REVIEWER)
  if (request.action === 'ISSUE_REVIEW') {
    if (!wsMembership || wsMembership.role !== 'REVIEWER') {
      return { allowed: false, denyReason: 'ROLE_REQUIRED: Emisión de dictamen requiere rol explícito REVIEWER en el workspace' };
    }
    if (resource.resourceState !== 'SUBMITTED') {
      return { allowed: false, denyReason: 'STATE_INVALID: Dictamen solo permitido sobre documentos en estado SUBMITTED' };
    }
    const isAuthor = resource.assignedUserId === context.userId;
    const isCoauthor = resource.coauthorUserIds?.includes(context.userId);
    if (isAuthor || isCoauthor) {
      return { allowed: false, denyReason: 'CONFLICT_OF_INTEREST: El autor o coautor no puede revisar su propia obra' };
    }
    if (resource.specialtyRequired && context.specialty !== resource.specialtyRequired) {
      return { allowed: false, denyReason: 'SPECIALTY_MISMATCH: Especialidad requerida no coincide con la del revisor' };
    }
    return { allowed: true, grantReason: 'GRANT_ISSUE_REVIEW: Revisor independiente verificado' };
  }

  // ACCIÓN: APPROVE_DECISION (Estrictamente APPROVER en Órgano de Autoridad y Ámbito C-05)
  if (request.action === 'APPROVE_DECISION') {
    if (resource.resourceState !== 'FROZEN') {
      return { allowed: false, denyReason: 'STATE_INVALID: Aprobación exige versión congelada (FROZEN)' };
    }
    const isAuthor = resource.assignedUserId === context.userId;
    const isCoauthor = resource.coauthorUserIds?.includes(context.userId);
    if (isAuthor || isCoauthor) {
      return { allowed: false, denyReason: 'CONFLICT_OF_INTEREST: El autor o coautor no puede votar la aprobación' };
    }
    const hasEffectiveApproverRole = context.effectiveRoleAssignments.some(
      ra => ra.organizationId === resource.organizationId &&
           (ra.assignedRole === 'APPROVER' || ra.role === 'APPROVER') &&
           ra.scopeType === 'AUTHORITY_BODY' &&
           ra.scopeId === resource.authorityBodyId &&
           ra.isActive &&
           isFiniteValidDateRange(ra.validFrom, ra.validUntil)
    );
    if (!hasEffectiveApproverRole) {
      return { allowed: false, denyReason: 'AUTHORITY_BODY_MEMBERSHIP_INVALID: Requiere asignación efectiva persistida con rol APPROVER en el órgano de autoridad objetivo' };
    }
    if (resource.territoryScope && context.scopeTerritory !== resource.territoryScope) {
      return { allowed: false, denyReason: 'TERRITORY_SCOPE_MISMATCH: El ámbito territorial no abarca el del recurso' };
    }
    return { allowed: true, grantReason: 'GRANT_APPROVE: Aprobación formal concedida por miembro autorizado' };
  }

  // ACCIÓN: PUBLISH (Rol PUBLISHER con Validación Estricta de Ámbito Organizacional y Workspace C-05)
  if (request.action === 'PUBLISH') {
    if (resource.resourceState !== 'APPROVED') {
      return { allowed: false, denyReason: 'STATE_INVALID: Publicación exige resolución previa estado APPROVED' };
    }
    const pubAssignment = context.effectiveRoleAssignments.find(
      ra => ra.organizationId === resource.organizationId &&
           (ra.assignedRole === 'PUBLISHER' || ra.role === 'PUBLISHER') &&
           ((ra.scopeType === 'ORGANIZATION' && ra.scopeId === resource.organizationId) ||
            (ra.scopeType === 'WORKSPACE' && ra.scopeId === resource.workspaceId)) &&
           ra.isActive &&
           isFiniteValidDateRange(ra.validFrom, ra.validUntil)
    );
    if (!pubAssignment) {
      return { allowed: false, denyReason: 'ROLE_REQUIRED: Requiere asignación efectiva de rol PUBLISHER asignada en la organización o workspace del recurso' };
    }
    return { allowed: true, grantReason: 'GRANT_PUBLISH: Publicación autorizada en el ámbito correspondiente' };
  }

  // ACCIÓN: EMERGENCY_UNPUBLISH
  if (request.action === 'EMERGENCY_UNPUBLISH') {
    if (wsMembership?.role === 'PUBLISHER' || hasAdminRole) {
      return { allowed: true, grantReason: 'GRANT_EMERGENCY_UNPUBLISH: Despublicación de emergencia autorizada' };
    }
  }

  // ACCIÓN: ASSIGN_GOVERNANCE_ROLE (Diferido a función SQL transaccional)
  if (request.action === 'ASSIGN_GOVERNANCE_ROLE') {
    if (!request.requestId) {
      return { allowed: false, denyReason: 'REQUEST_ID_REQUIRED: Se requiere un identificador de solicitud persistido' };
    }
    return { 
      allowed: false, 
      requiresTransactionalExecution: true,
      denyReason: 'DEFER_TO_TRANSACTIONAL_COMMAND: La asignación exige ejecutar grant_governance_role_transactional en la base de datos' 
    };
  }

  // ACCIÓN: AUDIT_READ (Estrictamente con Asignación Persistida de Ámbito Organizacional C-05)
  if (request.action === 'AUDIT_READ') {
    const auditAssignment = context.effectiveRoleAssignments.find(
      ra => ra.organizationId === resource.organizationId &&
           (ra.assignedRole === 'AUDITOR' || ra.role === 'AUDITOR') &&
           ((ra.scopeType === 'ORGANIZATION' && ra.scopeId === resource.organizationId) ||
            (ra.scopeType === 'WORKSPACE' && ra.scopeId === resource.workspaceId)) &&
           ra.isActive &&
           isFiniteValidDateRange(ra.validFrom, ra.validUntil)
    );
    if (auditAssignment) {
      return { allowed: true, grantReason: 'GRANT_AUDIT_READ: Acceso de lectura de auditoría inmutable concedido por asignación efectiva' };
    }
    return { allowed: false, denyReason: 'ROLE_REQUIRED: Acceso exclusivo para rol AUDITOR dentro del ámbito de la organización' };
  }

  return { allowed: false, denyReason: 'DEFAULT_DENY: Ninguna regla de concesión explícita se satisfizo' };
}

/**
 * Suite de Pruebas Unitarias de Autorización (TypeScript)
 */
export function runAuthorizationTests(): { total: number; passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function assertTest(name: string, condition: boolean) {
    if (condition) {
      passed++;
    } else {
      failed++;
      console.error(`AUTH TEST FAILED: ${name}`);
    }
  }

  // Test 1: Admin en context.roles no puede publicar (Unconditional Deny)
  const t1 = evaluateAuthorizationContract(
    {
      userId: 'admin1',
      isAnonymous: false,
      activeOrganizationId: 'org1',
      roles: ['ADMIN'],
      organizationMemberships: [{ organizationId: 'org1', isActive: true }],
      workspaceMemberships: [{ organizationId: 'org1', workspaceId: 'ws1', role: 'ADMIN', isActive: true }],
      authorityMemberships: [],
      effectiveRoleAssignments: []
    },
    { resourceId: 'doc1', organizationId: 'org1', workspaceId: 'ws1', classification: 'PUBLICO', resourceState: 'APPROVED' },
    { action: 'PUBLISH' }
  );
  assertTest('Admin Unconditional Deny on Publish', t1.allowed === false && t1.denyReason?.includes('ADMIN_UNCONDITIONAL_DENY') === true);

  // Test 2: Membresía con validFrom en el futuro debe ser rechazada
  const t2 = evaluateAuthorizationContract(
    {
      userId: 'user1',
      isAnonymous: false,
      activeOrganizationId: 'org1',
      roles: ['WRITER'],
      organizationMemberships: [{ organizationId: 'org1', isActive: true, validFrom: '2999-01-01T00:00:00Z' }],
      workspaceMemberships: [{ organizationId: 'org1', workspaceId: 'ws1', role: 'WRITER', isActive: true }],
      authorityMemberships: [],
      effectiveRoleAssignments: []
    },
    { resourceId: 'doc1', organizationId: 'org1', workspaceId: 'ws1', classification: 'INTERNO', resourceState: 'DRAFT' },
    { action: 'READ' }
  );
  assertTest('Reject future validFrom membership', t2.allowed === false && t2.denyReason?.includes('CROSS_TENANT_VIOLATION') === true);

  // Test 3: ASSIGN_GOVERNANCE_ROLE retorna diferimiento transaccional SQL
  const t3 = evaluateAuthorizationContract(
    {
      userId: 'user1',
      isAnonymous: false,
      activeOrganizationId: 'org1',
      roles: ['COORDINATOR'],
      organizationMemberships: [{ organizationId: 'org1', isActive: true }],
      workspaceMemberships: [{ organizationId: 'org1', workspaceId: 'ws1', role: 'COORDINATOR', isActive: true }],
      authorityMemberships: [],
      effectiveRoleAssignments: [],
      mfaVerifiedAt: new Date().toISOString(),
      mfaAgeSeconds: 10
    },
    { resourceId: 'doc1', organizationId: 'org1', workspaceId: 'ws1', classification: 'INTERNO', resourceState: 'DRAFT' },
    { action: 'ASSIGN_GOVERNANCE_ROLE', requestId: 'req123' }
  );
  assertTest('Defer ASSIGN_GOVERNANCE_ROLE to SQL transaction', t3.allowed === false && t3.requiresTransactionalExecution === true);

  // Test 4: Publisher asignado a ws-other NO puede publicar recurso en ws-target (Prueba adversarial C-05)
  const t4 = evaluateAuthorizationContract(
    {
      userId: 'pub1',
      isAnonymous: false,
      activeOrganizationId: 'org1',
      roles: ['PUBLISHER'],
      organizationMemberships: [{ organizationId: 'org1', isActive: true }],
      workspaceMemberships: [{ organizationId: 'org1', workspaceId: 'ws-target', role: 'WRITER', isActive: true }],
      authorityMemberships: [],
      effectiveRoleAssignments: [{
        id: 'ra1',
        organizationId: 'org1',
        scopeType: 'WORKSPACE',
        scopeId: 'ws-other',
        assignedRole: 'PUBLISHER',
        isActive: true,
        validFrom: '2020-01-01T00:00:00Z'
      }],
      mfaVerifiedAt: new Date().toISOString(),
      mfaAgeSeconds: 10
    },
    { resourceId: 'doc1', organizationId: 'org1', workspaceId: 'ws-target', classification: 'INTERNO', resourceState: 'APPROVED' },
    { action: 'PUBLISH' }
  );
  assertTest('Reject publisher assigned to different workspace', t4.allowed === false && t4.denyReason?.includes('ROLE_REQUIRED') === true);

  // Test 5: Publisher con scope ORGANIZATION de otra org no puede publicar (Prueba adversarial C-05)
  const t5 = evaluateAuthorizationContract(
    {
      userId: 'pub2',
      isAnonymous: false,
      activeOrganizationId: 'org1',
      roles: ['PUBLISHER'],
      organizationMemberships: [{ organizationId: 'org1', isActive: true }],
      workspaceMemberships: [],
      authorityMemberships: [],
      effectiveRoleAssignments: [{
        id: 'ra2',
        organizationId: 'org1',
        scopeType: 'ORGANIZATION',
        scopeId: 'org-other',
        assignedRole: 'PUBLISHER',
        isActive: true,
        validFrom: '2020-01-01T00:00:00Z'
      }],
      mfaVerifiedAt: new Date().toISOString(),
      mfaAgeSeconds: 10
    },
    { resourceId: 'doc1', organizationId: 'org1', workspaceId: 'ws1', classification: 'INTERNO', resourceState: 'APPROVED' },
    { action: 'PUBLISH' }
  );
  assertTest('Reject publisher with organization scope matching different org ID', t5.allowed === false && t5.denyReason?.includes('ROLE_REQUIRED') === true);

  // Test 6: Auditor con scope de workspace no relacionado denegado (Prueba adversarial C-05)
  const t6 = evaluateAuthorizationContract(
    {
      userId: 'auditor1',
      isAnonymous: false,
      activeOrganizationId: 'org1',
      roles: ['AUDITOR'],
      organizationMemberships: [{ organizationId: 'org1', isActive: true }],
      workspaceMemberships: [],
      authorityMemberships: [],
      effectiveRoleAssignments: [{
        id: 'ra3',
        organizationId: 'org1',
        scopeType: 'WORKSPACE',
        scopeId: 'ws-unrelated',
        assignedRole: 'AUDITOR',
        isActive: true,
        validFrom: '2020-01-01T00:00:00Z'
      }]
    },
    { resourceId: 'doc1', organizationId: 'org1', workspaceId: 'ws-target', classification: 'INTERNO', resourceState: 'APPROVED' },
    { action: 'AUDIT_READ' }
  );
  assertTest('Auditor with unrelated workspace scope denied on audit read', t6.allowed === false && t6.denyReason?.includes('ROLE_REQUIRED') === true);

  // Test 7: Approver sin asignación persistida con scopeId del órgano de autoridad es denegado (Prueba adversarial C-05)
  const t7 = evaluateAuthorizationContract(
    {
      userId: 'approver1',
      isAnonymous: false,
      activeOrganizationId: 'org1',
      roles: [],
      organizationMemberships: [{ organizationId: 'org1', isActive: true }],
      workspaceMemberships: [],
      authorityMemberships: [{ organizationId: 'org1', authorityBodyId: 'body1', role: 'MEMBER', isActive: true }],
      effectiveRoleAssignments: [],
      mfaVerifiedAt: new Date().toISOString(),
      mfaAgeSeconds: 10
    },
    { resourceId: 'doc1', organizationId: 'org1', workspaceId: 'ws1', authorityBodyId: 'body1', classification: 'INTERNO', resourceState: 'FROZEN' },
    { action: 'APPROVE_DECISION' }
  );
  assertTest('Approver without persistent role assignment on target authority body denied', t7.allowed === false && t7.denyReason?.includes('AUTHORITY_BODY_MEMBERSHIP_INVALID') === true);

  return { total: passed + failed, passed, failed };
}
