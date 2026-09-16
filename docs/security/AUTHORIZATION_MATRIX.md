# Matriz de Autorización Causal y Contrato de Dominio — Política Canon v0.2.18

**Estado:** `VIGENTE (RATIFICACIÓN HUMANA)`  
**Fecha:** 2026-09-16  
**Paquete:** `politica-canon-v0.2.18`  

---

## 1. Principio Fundacional: Default-Deny Absoluto

Toda solicitud a la API de la intranet o ejecutor de comandos debe denegarse por defecto (`allowed = false`) salvo que exista una concesión explícita aplicable que verifique simultáneamente:

1. **Aislamiento Multi-tenant:** Coincidencia de `organization_id` entre el usuario activo y la entidad agregada, verificando que la membresía organizativa esté activa (`isActive === true`) y dentro del rango de vigencia (`validFrom <= now` y `validUntil > now`).
2. **Contexto de Workspace y Rol Específico:** Verificación de `workspaceMemberships` activo para el `workspaceId` del recurso y posesión del rol necesario en dicho espacio (`PUBLISHER`, `WRITER`, `COORDINATOR`, `REVIEWER`).
3. **Bloqueo Incondicional del Admin Técnico:** El rol `ADMIN` tiene estrictamente denegadas las acciones `APPROVE_DECISION` y `PUBLISH` sin excepción, independientemente de cualquier otro rol asignado.
4. **Estado Documental Válido:** Coincidencia entre la acción solicitada y el `resourceState` (`DRAFT`, `SUBMITTED`, `FROZEN`, `APPROVED`, `PUBLISHED`).
5. **MFA Finitico Obligatorio en Gobernanza:** Las acciones de gobernanza (`APPROVE_DECISION`, `PUBLISH`, `EMERGENCY_UNPUBLISH`, `ASSIGN_GOVERNANCE_ROLE`) exigen MFA verificado con validación finitica (`Number.isFinite(age)`, `age >= 0` y `age <= 900` segundos / 15 minutos).
6. **Conflicto de Interés Ampliado:** Ni el autor principal ni los coautores pueden emitir dictamen de revisión (`ISSUE_REVIEW`) ni aprobar resoluciones políticas (`APPROVE_DECISION`) sobre sus propios borradores.
7. **Lectura Pública Anónima Separada:** La lectura pública (`READ` en `PUBLICO`) de un recurso publicado (`PUBLISHED` y `ACTIVE`) no exige ni valida membresía organizativa (`isAnonymous === true`), permitiendo el acceso libre al portal público sin desencadenar `CROSS_TENANT_VIOLATION`.
8. **Asignación Nominal Obligatoria en Edición:** La edición (`EDIT`) y el envío a revisión (`SUBMIT_FOR_REVIEW`) de borradores en estado `DRAFT` exigen que el usuario solicitante sea el autor asignado (`assignedUserId`) o coautor, o bien posea el rol `COORDINATOR` del espacio.
9. **Doble Control Cero Confianza Cliente:** El DTO de entrada `AuthorizationRequest` enviada por el cliente NO ACEPTA banderas de confianza ni aprobaciones precargadas. La asignación de roles sensible se realiza exclusivamente mediante el procedimiento transaccional `grant_governance_role_transactional(p_organization_id, p_request_id)` en la base de datos PostgreSQL, y el evaluador devuelve `requiresTransactionalExecution: true` con `allowed: false`.
10. **Lectura de Auditoría Acotada:** La acción `AUDIT_READ` exige el rol `AUDITOR` derivado de `role_assignments` y está acotada estrictamente a la organización del contexto activo.

---

## 2. Contrato Ejecutable TypeScript (`src/auth/authorization.ts`)

> El código fuente compilable y ejecutable de la matriz de autorización se encuentra formalizado en:
> [`src/auth/authorization.ts`](../../src/auth/authorization.ts)

```typescript
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
  role: UserRole;
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
```
