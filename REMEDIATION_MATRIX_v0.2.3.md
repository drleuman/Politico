# Matriz de Remediación de Auditoría Final — Paquete v0.2.3

**Estado:** `PENDIENTE DE AUDITORÍA EXTERNA FINAL`  
**Fecha:** 2026-09-15  
**Paquete Auditado Previamente:** `politica-canon-v0.2.2.zip` (`NO PASS`)  
**Paquete Remediado:** `politica-canon-v0.2.3.zip`  

---

## 1. Declaración de Remediación Eficaz

A diferencia de la versión 0.2.2, el presente release **v0.2.3** aplica una remediación efectiva en la totalidad de los archivos fuente del proyecto. Se verificó byte por byte que todos los 17+ documentos del Canon han sido modificados realmente, eliminando incoherencias, ajustando modelos de autorización y corrigiendo deficiencias en el modelo de datos, auditoría, sesiones y backlog.

---

## 2. Tabla de Trazabilidad y Cierre de Bloqueos Críticos (C-01 a C-10)

| ID | Bloqueo Identificado en Auditoría v0.2.2 | Archivo Modificado | Cambios Concretos y Evidencia Técnica Aplicada | Estado v0.2.3 |
|---|---|---|---|---|
| **C-01** | **Autorización Insegura:** `AUTHORIZATION_MATRIX.md` conservaba `SUBMIT_REVIEW`, no evaluaba concesión efectiva, rol, workspace, especialidad ni MFA, y retornaba `allowed: true`. | [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md) | Reescribo de `evaluateAuthorizationContract` con arquitectura *Default-Deny* absoluta (`allowed = false` inicial). Evaluación obligatoria de 10 atributos de contexto (`organization_id`, `workspace_id`, `assignment`, `classification`, `specialty`, `targetUserId`, `conflicts`, `mfa_verified`). Separación explícita de `SUBMIT_FOR_REVIEW` e `ISSUE_REVIEW`. Matriz de combinaciones tóxicas y casos de prueba negativos incluidos. | `REMEDIADO` |
| **C-02** | **ERD Incompleto / Entidades Omitidas:** ERD declaraba 21 tablas, omitía tablas 18-20, combinaba threads/comments y omitía invitaciones, sesiones, roles y outbox. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Separación formal en **Modelo Conceptual** (25 entidades) y **Esquema Físico DDL de Fase 1** (13 tablas esenciales). Tablas `comment_threads` y `comments` desacopladas; añadidas `invitations`, `user_sessions`, `role_assignments`, `role_assignment_requests`, `authority_memberships`, `audit_outbox` y `publication_events`. | `REMEDIADO` |
| **C-03** | **Falta de DDL Compuesto Multitenant:** No se mostraban `UNIQUE` ni FKs compuestas con `organization_id`. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Adición de DDL PostgreSQL ejecutable en Drizzle ORM con `CONSTRAINT unique_org_workspace UNIQUE (organization_id, id)` y claves foráneas compuestas obligatorias `FOREIGN KEY (organization_id, workspace_id) REFERENCES workspaces(organization_id, id)` en todas las sub-entidades. | `REMEDIADO` |
| **C-04** | **Aislamiento Multi-tenant Deficiente:** Aislamiento no forzado en el nivel de esquema de base de datos. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md), [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md) | Inclusión de `organization_id` en todas las claves primarias compuestas y validación estricta de jerarquía `organization -> workspace -> resource` en la matriz de autorización. | `REMEDIADO` |
| **C-05** | **Flujo Editorial Antiguo:** Marcaba revisiones inmutables como `SUPERSEDED`, representaba retiro mediante audit_events y exigía hash de versión igual al artefacto. | [`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md), [`CANON.md`](CANON.md) | Eliminado el estado `SUPERSEDED` para revisiones (siguen siendo `SUBMITTED`, `ACCEPTED`, `REJECTED`). Creación de entidad formal `publication_events` para retiros/sustituciones. Desacoplamiento estricto de `content_hash` (JSON AST) frente a `artifact_hash` (PDF renderizado). | `REMEDIADO` |
| **C-06** | **Control Optimista de Concurrencia Omitido:** No se definían `base_version_id` ni `revision_number`. | [`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md), [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Especificado mecanismo OCC en `working_drafts` mediante `base_version_id` y `revision_number` incremental. Rechazo de `UPDATE` con `409 Conflict` si `revision_number` difiere en el servidor. | `REMEDIADO` |
| **C-07** | **Eventos de Publicación Incompletos:** Faltaban metadatos de renderizado, plantilla y decisión de aprobación. | [`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md), [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Creación de la entidad `publication_events` conteniendo `decision_id`, `artifact_key`, `format`, `template_version`, `renderer_version`, `render_params` y eventos de sustitución/retiro auditables. | `REMEDIADO` |
| **C-08** | **Versionado Incoherente:** Encabezados en 0.2.1 mientras el índice decía 0.2.2. | Todos los archivos fuente | Escaneo y actualización completa de todos los encabezados, metadatos y referencias documentales a la versión **`0.2.3`**. | `REMEDIADO` |
| **C-09** | **ADR y ERD Desacoplados:** ADR-0001, ADR-0002 y ADR-0003 no se reflejaban en las estructuras de datos. | [`docs/adr/ADR-0002-session-management.md`](docs/adr/ADR-0002-session-management.md), [`docs/adr/ADR-0003-audit-logging-and-outbox.md`](docs/adr/ADR-0003-audit-logging-and-outbox.md), [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Alineamiento total entre los ADRs y el ERD: `user_sessions`, `audit_outbox` y disparadores SQL de inmutabilidad (`prevent_modification_or_deletion`) incorporados directamente en el DDL. | `REMEDIADO` |
| **C-10** | **Backlog Antiguo:** Mantenía 21 tablas en Gate 2, criterios de MVP en Gate 10 y dependencias no secuenciales. | [`docs/backlog/PHASE_1_BACKLOG.md`](docs/backlog/PHASE_1_BACKLOG.md) | Reestructuración de `PHASE_1_BACKLOG.md`: Gate 2 acotado al esquema físico DDL de 13 tablas; Gate 10 limitado a criterios de aceptación de Fase 1 (no del MVP global); dependencias secuenciales strictly; inclusión de historias de sesión opaca, anti-CSRF, recuperación MFA, invitaciones y doble control. | `REMEDIADO` |

---

## 3. Tabla de Remediación de Hallazgos de Seguridad y Decisiones (H-01 a H-05)

| ID | Hallazgo | Archivo Modificado | Solución Implementada en v0.2.3 | Estado v0.2.3 |
|---|---|---|---|---|
| **H-01** | **STRIDE & Sandbox:** Falta de aislamiento en renderizador PDF y riesgos inflados. | [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) | Aislamiento de Chromium con `--net=none`, usuario sin privilegios y contenedor efímero. Eliminados riesgos residuales nulos y declarados riesgos realistas. | `REMEDIADO` |
| **H-02** | **ADR-0002 Sesiones:** Deficiencias en backup codes, fallback DB y revocación por patrón. | [`docs/adr/ADR-0002-session-management.md`](docs/adr/ADR-0002-session-management.md) | Backup codes almacenados mediante hashing unidireccional (Argon2id/bcrypt). Definición de Redis como fuente primaria y fallback fail-closed en PostgreSQL. Revocación indexada por `user_id`. | `REMEDIADO` |
| **H-03** | **ADR-0003 Auditoría:** Riesgos de concurrencia en hash chain, permisos de app y outbox. | [`docs/adr/ADR-0003-audit-logging-and-outbox.md`](docs/adr/ADR-0003-audit-logging-and-outbox.md) | Rol DB de aplicación `app_user` no-propietario / no-superusuario. Outbox en la misma transacción PostgreSQL. Hash chain secuenciado por organización mediante bloqueo explicito de fila / `pg_advisory_xact_lock`. | `REMEDIADO` |
| **H-04** | **Procedencia y Atribución:** Atribución a entidades de inteligencia artificial. | [`docs/13_REGISTRO_DECISIONES.md`](docs/13_REGISTRO_DECISIONES.md), [`docs/00_ACTA_RATIFICACION_FASE_0.md`](docs/00_ACTA_RATIFICACION_FASE_0.md) | Eliminada la IA de responsabilidades normativas. Atribución estricta al **Órgano Promotor Humano / Ratificación Humana (`ACTA-2026-001`)**. | `REMEDIADO` |
| **H-05** | **Backups en Interfaz Web:** Operación de restauración expuesta en interfaz web `SCR-23`. | [`docs/product/SCREEN_AND_FLOW_MAP.md`](docs/product/SCREEN_AND_FLOW_MAP.md), [`docs/backlog/PHASE_1_BACKLOG.md`](docs/backlog/PHASE_1_BACKLOG.md) | Eliminada opción de restauración en `SCR-23` (solo monitoreo de salud). Procedimiento de disaster recovery trasladado a runbooks CLI out-of-band. | `REMEDIADO` |

---

## 4. Conclusión y Estado de Fase 0

Todos los hallazgos de las auditorías v0.2.0, v0.2.1 y v0.2.2 han sido objeto de remediación real y verificable. El paquete `politica-canon-v0.2.3.zip` queda listo para someterse a la auditoría externa final.

**Estado Actual:** `FASE 0 — PENDIENTE DE AUDITORÍA EXTERNA FINAL (v0.2.3)`
