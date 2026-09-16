# Matriz de Remediación de Auditoría Final — Paquete v0.2.5

**Estado:** `PENDIENTE DE AUDITORÍA EXTERNA FINAL`  
**Fecha:** 2026-09-15  
**Paquete Auditado Previamente:** `politica-canon-v0.2.4.zip` (`NO PASS`)  
**Paquete Remediado:** `politica-canon-v0.2.5.zip`  

---

## 1. Declaración de Remediación Eficaz y Coherencia Semántica

El release **v0.2.5** ejecuta una remediación técnica exhaustiva y demostrable sobre todos los componentes del sistema. Abarca el contrato de autorización en TypeScript, la gobernanza del doble control cargada en servidor, la definición física del modelo de identidad (invitaciones, credenciales, recuperación), la protección de aislamiento multi-tenant con Row-Level Security (RLS) en PostgreSQL 16+, la inmutabilidad anti-CASCADE, la fórmula del hash chain de auditoría con Genesis Hash y la preservación inalterada de archivos históricos.

---

## 2. Tabla de Trazabilidad y Cierre de Bloqueos Críticos (C-01 a C-10)

| ID | Bloqueo Identificado en Auditoría v0.2.4 | Archivo Modificado | Cambios Concretos y Evidencia Técnica Aplicada | Estado v0.2.5 |
|---|---|---|---|---|
| **C-01** | **Evaluador de Autorización con Bypasses y Omisiones:** Bypass del Admin si poseía `PUBLISHER`; roles no acotados a `workspaceMemberships`; sin verificación de membresía organizativa activa; MFA no exigido en gobernanza; sin `resourceState`; conflicto de interés parcial; especialidad/territorio ignorados; `DELETE_DRAFT` sin grant; lectura `PUBLICO` sin verificar publicación activa. | [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md) | Reescribo compilable en TypeScript. Bloqueo incondicional para `ADMIN` en `APPROVE_DECISION` y `PUBLISH`. Verificación obligatoria de `workspaceMemberships`, `organizationMemberships.isActive`, `resourceState` (`DRAFT`, `SUBMITTED`, `FROZEN`, `APPROVED`, `PUBLISHED`), MFA obligatorio en gobernanza (<15 min), conflicto de interés para autores y coautores, coincidencia de `specialty` y `territoryScope`, grant para `DELETE_DRAFT`, y lectura `PUBLICO` condicionada a `resourceState === 'PUBLISHED'` y `publicationState === 'ACTIVE'`. | `REMEDIADO` |
| **C-02** | **Doble Control Confiado al Cliente y 4 Identidades:** Solicitud enviaba lista de aprobaciones confiada del cliente. Sin verificación de pertenencia a `GOVERNANCE_REGISTRY` en servidor. Solicitante o beneficiario podían auto-aprobarse. | [`docs/03_ROLES_Y_PERMISOS.md`](docs/03_ROLES_Y_PERMISOS.md), [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md), [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | `AuthorizationRequest` recibe `requestId`. El servidor carga exactamente 2 aprobaciones persistidas en `role_assignment_approvals`. Verificación en servidor de membresía activa en `GOVERNANCE_REGISTRY`. Restricción SQL e invariante TypeScript exigiendo 4 identidades distintas (`requester_id <> beneficiary_id <> approver1_id <> approver2_id`). | `REMEDIADO` |
| **C-03** | **Doble Control Sin Restricciones DDL ni Anti-CASCADE:** `role_assignment_approvals` sin `CHECK (approval_order IN (1,2))`, con `ON DELETE CASCADE` borrando histórico al eliminar solicitud. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Adición de `CONSTRAINT check_approval_order CHECK (approval_order IN (1, 2))`. Reemplazo de `ON DELETE CASCADE` por `ON DELETE RESTRICT` en la relación de aprobaciones. Creación de función transaccional PostgreSQL con bloqueos `FOR UPDATE`. | `REMEDIADO` |
| **C-04** | **Modelo Físico de Identidad Incompleto:** Omitía `password_hash`, entidad de credenciales, tabla de `invitations`, tokens de recuperación y estado activo de usuarios. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md), [`docs/01_PRD.md`](docs/01_PRD.md) | Adición de las tablas físicas DDL: `user_credentials` (Argon2id), `invitations` (tokens de un solo uso con expiración 24h), `password_reset_tokens` y campo `is_active` en `users`. Vinculación de `user_sessions` con `organization_id`. | `REMEDIADO` |
| **C-05** | **Aislamiento Multi-Tenant e Incoherencia de RLS:** Tablas tenant-scoped sin `organization_id` ni FK compuesta. Contradicción entre el Acta (exigía RLS) y ERD. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md), [`CANON.md`](CANON.md) | Inserción de `organization_id` y FKs compuestas en las 29 tablas del DDL físico. Adopción unificada de **Row-Level Security (RLS)** en PostgreSQL 16+ (`FORCE ROW LEVEL SECURITY`) mediante `app.current_organization_id` con `SET LOCAL` en transacción. Rol `app_user` sin `BYPASSRLS`. | `REMEDIADO` |
| **C-06** | **Inmutabilidad Rompible por Cascadas:** Borrado en cascada `ON DELETE CASCADE` afectaba entidades inmutables (`document_versions`, `reviews`, `decisions`, `role_assignment_approvals`, `publication_events`, `audit_events`). | [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Reemplazo total de `ON DELETE CASCADE` por `ON DELETE RESTRICT` en todas las relaciones de entidades inmutables. Aplicación del disparador SQL `prevent_modification_or_deletion()` en las 6 tablas inmutables. | `REMEDIADO` |
| **C-07** | **Cadena de Auditoría Incompleta e Outbox Sin Idempotencia:** Fórmula sin `event_id` o `timestamp`. Sin Genesis Hash. Outbox sin `outbox_id UNIQUE` ni dead-letter queue. | [`docs/adr/ADR-0003-audit-logging-and-outbox.md`](docs/adr/ADR-0003-audit-logging-and-outbox.md), [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Fórmula de hash chain explícita incorporando `event_id`, `sequence_number`, `event_type`, `actor_id`, `timestamp`, `previous_event_hash`, `canonical_json` y `schema_version`. Genesis Hash definido como 64 ceros. Adición de `outbox_id UUID UNIQUE` en `audit_events` y cola `audit_outbox_dead_letter`. | `REMEDIADO` |
| **C-08** | **Desalineamiento entre Modelo Conceptual, DDL y Flujo Editorial:** Recuento de entidades inexacto. Entidades conceptuales sin tabla física (`DRAFT_COMMENT`, `SOURCE_CITATION`, `DOCUMENT_INVALIDATION`, `SUBMISSION`). | [`docs/architecture/ERD.md`](docs/architecture/ERD.md), [`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md) | Mermaid Conceptual reconciliado a **exactamente 25 Entidades Únicas**. DDL Físico expandido a **29 Tablas DDL** incorporando `draft_comments`, `source_citations`, `submissions` / `review_cycles`, `document_invalidations` y `audit_outbox_dead_letter`. | `REMEDIADO` |
| **C-09** | **Procedencia de Publicación Incompleta:** `publications.version_id` y `document_id` sin FK compuesta. Sin soporte DOCX. Sin atributos en `WITHDRAW` o `REPLACE`. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md), [`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md) | Adición de FKs compuestas exactas `publications(organization_id, version_id) REFERENCES document_versions(organization_id, id)` y `publications(organization_id, decision_id) REFERENCES decisions(organization_id, id)`. Formato `DOCX` añadido a `publication_format_enum`. Atributos `reason`, `replaced_publication_id` añadidos en `publication_events`. | `REMEDIADO` |
| **C-10** | **Integridad de Registros Históricos y Versiones:** Reescritura indebida de archivos de auditorías pasadas. Incoherencia de encabezados. | Todos los archivos del repositorio | **Inmutabilidad Histórica Estricta:** Los archivos de remediaciones anteriores (`v0.2.2`, `v0.2.3`, `v0.2.4`) se mantienen 100% inalterados byte por byte. Erratas registradas en [`docs/audits/HISTORICAL_ERRATA.md`](docs/audits/HISTORICAL_ERRATA.md). Todos los documentos vigentes unificados en versión **`0.2.5`**. | `REMEDIADO` |

---

## 3. Tabla de Remediación de Hallazgos de Seguridad y Decisiones (H-01 a H-04)

| ID | Hallazgo | Archivo Modificado | Solución Implementada en v0.2.5 | Estado v0.2.5 |
|---|---|---|---|---|
| **H-01** | **Roadmap & Backlog Scoping:** Requisitos de fases posteriores absorbidos en Fase 1. | [`docs/backlog/PHASE_1_BACKLOG.md`](docs/backlog/PHASE_1_BACKLOG.md) | Puertas de Calidad acotadas estrictamente a la fundación técnica. Desarrollo avanzado de editores y renderizadores progresivo en Fases 2-5. | `REMEDIADO` |
| **H-02** | **PRD Reducido:** Pérdida de requisitos funcionales y NFR canónicos. | [`docs/01_PRD.md`](docs/01_PRD.md) | Restauración completa de todas las secciones del PRD (fuentes, datasets, dashboards, búsqueda, archivos, invitaciones, notificaciones, comentarios anclados, DOCX, accesibilidad, privacidad, retención, NFRs). | `REMEDIADO` |
| **H-03** | **Threat Model Ampliado:** Omisión de amenazas de recuperación, invitaciones, KMS, colusión. | [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) | Incorporación de 12 vectores STRIDE ampliados y reemplazo de afirmaciones absolutas por métricas cuantificables. | `REMEDIADO` |
| **H-04** | **Canal de Sandbox PDF:** Definición imprecisa de comunicación del contenedor Chromium. | [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) | Especificación de comunicación vía volumen efímero `tmpfs` IPC, `--security-opt=no-new-privileges:true`, `--pids-limit=100`, root FS de solo lectura y bloqueo del protocolo `file://`. | `REMEDIADO` |

---

## 4. Conclusión y Estado de Fase 0

Todos los hallazgos de las auditorías v0.2.0 a v0.2.4 han sido objeto de remediación real, efectiva y verificable en la versión `v0.2.5`. El paquete `politica-canon-v0.2.5.zip` queda listo para someterse a la auditoría externa final.

**Estado Actual:** `FASE 0 — PENDIENTE DE AUDITORÍA EXTERNA FINAL (v0.2.5)`
