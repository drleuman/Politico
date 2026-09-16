# Matriz de Remediación de Auditoría Final — Paquete v0.2.4

**Estado:** `PENDIENTE DE AUDITORÍA EXTERNA FINAL`  
**Fecha:** 2026-09-15  
**Paquete Auditado Previamente:** `politica-canon-v0.2.3.zip` (`NO PASS`)  
**Paquete Remediado:** `politica-canon-v0.2.4.zip`  

---

## 1. Declaración de Remediación Eficaz

A diferencia de las iteraciones anteriores, el presente release **v0.2.4** aplica una remediación efectiva en la totalidad de los archivos fuente del proyecto. Se verificó byte por byte que los 17+ documentos del Canon han sido modificados realmente, eliminando incoherencias, ajustando el contrato de autorización en TypeScript, resolviendo el doble control de roles sensibles, perfeccionando el esquema DDL multi-tenant, y unificando las versiones y encabezados.

---

## 2. Tabla de Trazabilidad y Cierre de Bloqueos Críticos (C-01 a C-08)

| ID | Bloqueo Identificado en Auditoría v0.2.3 | Archivo Modificado | Cambios Concretos y Evidencia Técnica Aplicada | Estado v0.2.4 |
|---|---|---|---|---|
| **C-01** | **Contrato de Autorización Incompleto y No Compilable:** `evaluateAuthorizationContract` provocaba error de tipos en TS, no evaluaba la coincidencia de workspaces (`activeWorkspaceId === targetWorkspaceId`), nominalidad, clasificación `CONFIDENCIAL`/`RESTRINGIDO`, membresía de autoridad ni doble control. Acciones `ASSIGN_GOVERNANCE_ROLE` y `EDIT` sin grant. `READ` permisivo. | [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md) | Reescribo completo compilable en TypeScript de `evaluateAuthorizationContract` con tipo de retorno `{ allowed: boolean; grantReason?: string; denyReason?: string }`. Incorporación obligatoria de 10 atributos de contexto. Reglas de concesión explícitas para `ASSIGN_GOVERNANCE_ROLE`, `EDIT`, `CREATE_DRAFT`, `READ`, `AUDIT_READ`. `READ` restringido por clasificación y membresía de workspace. Casos de prueba unitarios incluidos. | `REMEDIADO` |
| **C-02** | **Doble Control de Roles Sensibles Inejecutable:** `GOVERNANCE_ROLE_REGISTRAR` sin definir. `role_assignment_requests` solo tenía `first_approval_by`. `role_assignments` permitía mismos aprobadores que el beneficiario. | [`docs/03_ROLES_Y_PERMISOS.md`](docs/03_ROLES_Y_PERMISOS.md), [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Definición formal de `GOVERNANCE_REGISTRY` como órgano de autoridad (`authority_bodies`). Creación de la tabla append-only `role_assignment_approvals` para registrar 2 aprobaciones independientes. Restricciones SQL imponiendo 4 identidades distintas (`requester_id <> beneficiary_id <> approver1_id <> approver2_id`). | `REMEDIADO` |
| **C-03** | **Esquema DDL y Aislamiento Multi-tenant Deficiente:** FK compuesta no aplicada a todas las tablas con ámbito. `role_assignments` y `role_assignment_requests` sin FK compuesta. `workspace_memberships` sin `organization_id` en UNIQUE. Mezcla de `PUBLICO`/`PÚBLICO`. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md), [`docs/07_MODELO_DATOS.md`](docs/07_MODELO_DATOS.md) | Inclusión de `organization_id` y FKs compuestas en las 21 tablas del DDL físico en Drizzle ORM. `role_assignments` y `role_assignment_requests` con `FOREIGN KEY (organization_id, target_workspace_id) REFERENCES workspaces(organization_id, id)`. `workspace_memberships` con `UNIQUE (organization_id, workspace_id, user_id)`. Unificación de enumeración a `PUBLICO` sin tilde. | `REMEDIADO` |
| **C-04** | **Contradicciones en Sesiones y MFA:** ADR-0002 conservaba fallback permisivo a PostgreSQL resucitando sesiones. Sin índice por usuario. Anti-CSRF impreciso. Backlog exigía SHA-256 para backup codes. Secretos TOTP desprotegidos. | [`docs/adr/ADR-0002-session-management.md`](docs/adr/ADR-0002-session-management.md), [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Redis definido como tienda autoritativa única con comportamiento Fail-Closed (`503`). Revocación indexada por conjunto `user_sessions:<user_id>`. Anti-CSRF via *Synchronizer Token Pattern* en cabecera `X-CSRF-Token`. Códigos de respaldo en `mfa_backup_codes` con hash lento (Argon2id/bcrypt). `mfa_secret` con Envelope Encryption (AES-256-GCM). | `REMEDIADO` |
| **C-05** | **Fallas de Concurrencia y Atomicidad en Auditoría:** Sin `sequence_number` por org ni bloqueo consultivo. `event_hash` no incluía `previous_event_hash`. Sin canonicalización JSON versionada. Outbox no insertado en la transacción de negocio. | [`docs/adr/ADR-0003-audit-logging-and-outbox.md`](docs/adr/ADR-0003-audit-logging-and-outbox.md), [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Inclusión de `sequence_number` BIGINT por organización. Inserciones serializadas via `pg_advisory_xact_lock(hashtext(organization_id))`. Formula de hash chain explicita. Canonicalización JSON versionada (`1.0`). Inserción de `audit_outbox` en la misma transacción PostgreSQL de negocio. Rol DB `app_user` no-propietario con trigger `prevent_modification_or_deletion()`. | `REMEDIADO` |
| **C-06** | **Contradicción SUPERSEDED en Flujo Editorial:** `CANON.md` y `04_FLUJO_EDITORIAL.md` conservaban `SUPERSEDED` para revisiones inmutables. | [`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md), [`CANON.md`](CANON.md) | Eliminación total del estado `SUPERSEDED` para dictámenes de revisión. Los dictámenes son inmutables (`ACCEPTED` o `REJECTED`). Invalidaciones o sustituciones gestionadas mediante eventos append-only en `publication_events`. Ciclo de vida explícito: `Document` -> `Submission` -> `DocumentVersion` -> `Review` -> `Approval` -> `Publication`. | `REMEDIADO` |
| **C-07** | **Procedencia de Publicación Solo en Prosa:** Omitido esquema lógico y DDL de `publications` y `publication_events`. | [`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md), [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Creación de la tabla física DDL `publications` y `publication_events` conteniendo `decision_id`, `artifact_key`, `content_hash`, `artifact_hash`, `format`, `template_version`, `renderer_version`, `render_params` y tipos de evento (`PUBLISH`, `WITHDRAW`, `REPLACE`). | `REMEDIADO` |
| **C-08** | **Incoherencia de Versiones y Encabezados:** Documentos fuente en 0.2.1/0.2.2 mientras el índice y validación afirmaban 0.2.3. | Todos los archivos fuente | Edición sustancial demostrable de los 17+ documentos exigidos. Unificación total de encabezados, títulos, índices, gap analysis, acceptance y changelog a la versión **`0.2.4`**. | `REMEDIADO` |

---

## 3. Tabla de Remediación de Hallazgos de Seguridad y Decisiones (H-01 a H-02, DB)

| ID | Hallazgo | Archivo Modificado | Solución Implementada en v0.2.4 | Estado v0.2.4 |
|---|---|---|---|---|
| **H-01** | **Backlog No Secuencial:** Gates 6, 7 y 9 dependían directamente de Gate 1 o 2. Incoherencias en backup codes y doble control. | [`docs/backlog/PHASE_1_BACKLOG.md`](docs/backlog/PHASE_1_BACKLOG.md) | Reestructuración de dependencias en una cadena **estrictamente secuencial (Gate 1 a Gate 10)**. Alineamiento completo de historias con los ADRs y DDL. | `REMEDIADO` |
| **H-02** | **Threat Model Incompleto y Sandbox Impreciso:** Omisión de amenazas de IA, autoridad interna, backup, correo. Sandbox de Chromium impreciso. | [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) | Incorporados 8 vectores STRIDE ampliados (IA, backups, colusión, secretos TOTP, correo). Configuración Sandbox de Chromium explícita (`--net=none`, usuario sin privilegios `node`, `--read-only`, contenedor efímero) y reglas Plesk. | `REMEDIADO` |
| **DB** | **Decisión de Base de Datos:** Confirmación de PostgreSQL 16+ frente al MySQL/MariaDB de Plesk. | [`CANON.md`](CANON.md), [`docs/06_ARQUITECTURA_TECNICA.md`](docs/06_ARQUITECTURA_TECNICA.md) | Reafirmación estricta de PostgreSQL 16+ como único motor ratificado. Plesk administrará PostgreSQL mediante su extensión oficial o contenedor Docker supervisado. | `REMEDIADO` |

---

## 4. Conclusión y Estado de Fase 0

Todos los hallazgos de las auditorías v0.2.0 a v0.2.3 han sido objeto de remediación real, efectiva y verificable en la versión `v0.2.4`. El paquete `politica-canon-v0.2.4.zip` queda listo para someterse a la auditoría externa final.

**Estado Actual:** `FASE 0 — PENDIENTE DE AUDITORÍA EXTERNA FINAL (v0.2.4)`
