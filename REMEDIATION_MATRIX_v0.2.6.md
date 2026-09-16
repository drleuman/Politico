# Matriz de Remediación de Auditoría Final — Paquete v0.2.6

**Estado:** `PENDIENTE DE AUDITORÍA EXTERNA FINAL`  
**Fecha:** 2026-09-15  
**Paquete Auditado Previamente:** `politica-canon-v0.2.5.zip` (`NO PASS`)  
**Paquete Remediado:** `politica-canon-v0.2.6.zip`  

---

## 1. Declaración de Remediación Eficaz y Coherencia Semántica

El release **v0.2.6** ejecuta una remediación técnica rigurosa y verificable sobre todos los hallazgos señalados en el dictamen v0.2.5. Abarca el contrato de autorización en TypeScript con denegación incondicional de Admin, el procedimiento transaccional de doble control en PostgreSQL (`grant_governance_role_transactional`), el esquema físico DDL ejecutable de 29 tablas con RLS en las 25 tablas tenant-scoped, la idempotencia del trabajador de auditoría outbox con Genesis Hash (64 ceros), la procedencia de publicación con claves compuestas exactas, la restauración completa del PRD y la preservación 100% inalterada de los informes de auditorías pasadas.

---

## 2. Tabla de Trazabilidad y Cierre de Bloqueos Críticos (C-01 a C-10)

| ID | Bloqueo Identificado en Auditoría v0.2.5 | Archivo Modificado | Cambios Concretos y Evidencia Técnica Aplicada | Estado v0.2.6 |
|---|---|---|---|---|
| **C-01** | **Evaluador de Autorización con Bypasses y Omisiones:** Bypass de Admin si poseía `PUBLISHER`; `APPROVE_DECISION` no exigía `APPROVER`; roles globales no acotados; `SUBMIT_FOR_REVIEW` y `EDIT` sin comprobación nominal de autoría; DTO aceptaba aprobaciones confiables del cliente. | [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md) | Reescribo en TypeScript con denegación incondicional para `ADMIN` en `APPROVE_DECISION` y `PUBLISH`. Verificación estricta de `authMem.role === 'APPROVER'`. Consulta de `workspaceMemberships` acotado. Validación nominal en `SUBMIT_FOR_REVIEW` y `EDIT` (autor/coautores o `COORDINATOR`). `ISSUE_REVIEW` estrictamente `REVIEWER`. Eliminados flags confiados del cliente (servidor carga desde BD). | `REMEDIADO` |
| **C-02** | **Doble Control Sin Función Transaccional:** Declaraba función SQL con `FOR UPDATE` no entregada en el DDL. Permitía auto-aprobación del solicitante o beneficiario. | [`docs/03_ROLES_Y_PERMISOS.md`](docs/03_ROLES_Y_PERMISOS.md), [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Creación de la función `SECURITY DEFINER` `grant_governance_role_transactional(request_id UUID)` en PostgreSQL con bloqueo `FOR UPDATE`, verificación de 2 aprobaciones registradas con `approval_order IN (1, 2)`, validación de membresías en `GOVERNANCE_REGISTRY` y restricción de 4 identidades distintas (`requester <> target <> approver1 <> approver2`). | `REMEDIADO` |
| **C-03** | **RLS Declarado en 29 Tablas pero Presente en Solo 1:** El DDL solo incluía RLS para `documents`. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Aplicación de `ENABLE ROW LEVEL SECURITY;` y `FORCE ROW LEVEL SECURITY;` a las 25 tablas tenant-scoped (con `organization_id`). Política RLS Pool-Safe con `SET LOCAL app.current_organization_id = '...'` dentro de transacciones. Rol de aplicación `app_user` configurado con `NOBYPASSRLS`. | `REMEDIADO` |
| **C-04** | **DDL Inejecutable por Orden de FKs:** `working_drafts` referenciaba `document_versions` antes de su creación. `ON DELETE SET NULL` sobre columna NOT NULL `organization_id`. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Reordenación de tablas en el DDL: `document_versions` definida **antes** de `working_drafts`. Corrección de la clave foránea `working_drafts.base_version_id REFERENCES document_versions(organization_id, id) ON DELETE SET NULL`. | `REMEDIADO` |
| **C-05** | **Procedencia de Publicación Incompleta:** FKs compuestas no garantizaban que la decisión aprobatoria correspondiera a la versión exactas publicada. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md), [`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md) | Adición de FKs compuestas exactas en `publications`: `FOREIGN KEY (organization_id, document_id, version_id) REFERENCES document_versions` y `FOREIGN KEY (organization_id, version_id, decision_id) REFERENCES decisions`, garantizando procedencia exacta. | `REMEDIADO` |
| **C-06** | **Cadena de Auditoría Outbox Sin Idempotencia ni Formato:** `audit_events.outbox_id` era nullable sin FK a `audit_outbox`. Sin Genesis Hash. Outbox sin máquina de estados. | [`docs/adr/ADR-0003-audit-logging-and-outbox.md`](docs/adr/ADR-0003-audit-logging-and-outbox.md), [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | `audit_events.outbox_id` configurado como `UUID NOT NULL UNIQUE REFERENCES audit_outbox(id) ON DELETE RESTRICT`. Definición de Genesis Hash (64 ceros). Algoritmo de worker con `status`, `claimed_at`, `locked_by` e inserción en `audit_outbox_dead_letter`. | `REMEDIADO` |
| **C-07** | **Invitaciones Eludían Doble Control:** `invitations.role` permitía invitar directamente roles sensibles (`ADMIN`, `APPROVER`, `PUBLISHER`, `AUDITOR`). | [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Adición de restricción SQL en `invitations`: `CONSTRAINT check_invitation_role CHECK (role NOT IN ('ADMIN', 'APPROVER', 'PUBLISHER', 'AUDITOR'))`. Los roles sensibles exigen doble control obligatorio. | `REMEDIADO` |
| **C-08** | **Mapeo Incoherente de Entidades y Tablas:** Errores de recuento entre entidades conceptuales y tablas DDL. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md), [`docs/07_MODELO_DATOS.md`](docs/07_MODELO_DATOS.md) | Diagrama Conceptual Mermaid ajustado a **27 Entidades Únicas**. Esquema Físico DDL ajustado a **29 Tablas DDL**. Publicado inventario de mapeo automatizado en `VALIDATION_REPORT_v0.2.6.md`. | `REMEDIADO` |
| **C-09** | **Procedencia y Tipos en Publicaciones:** Omitía formato `DOCX` y atributos de retiro/sustitución. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md), [`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md) | Formato `DOCX` añadido a `publication_format_enum`. Atributos `reason` y `replaced_publication_id` añadidos a `publication_events`. | `REMEDIADO` |
| **C-10** | **Inmutabilidad Histórica e Integridad de Versiones:** Modificación indebida de archivos de auditorías pasadas. | Todos los archivos del repositorio | **Informes de remediación y validación pasados (`v0.2.2`, `v0.2.3`, `v0.2.4`) conservados 100% inalterados byte por byte.** Erratas centralizadas en [`docs/audits/HISTORICAL_ERRATA.md`](docs/audits/HISTORICAL_ERRATA.md). Todos los documentos vigentes unificados en versión `0.2.6`. | `REMEDIADO` |

---

## 3. Tabla de Remediación de Hallazgos de Seguridad y Decisiones (H-01 a H-06)

| ID | Hallazgo | Archivo Modificado | Solución Implementada en v0.2.6 | Estado v0.2.6 |
|---|---|---|---|---|
| **H-01** | **MFA Timestamp Sin Validación Finitica:** Antigüedad de MFA admitía NaN o timestamps futuros. | [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md) | Validación finitica estricta: `Number.isFinite(age)`, `age >= 0` y `age <= 15` minutos. | `REMEDIADO` |
| **H-02** | **Triggers Anti-CASCADE Incompletos:** Entidades inmutables carecían de disparador anti-CASCADE. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Aplicación del disparador SQL `prevent_modification_or_deletion()` en las 9 tablas inmutables del sistema. | `REMEDIADO` |
| **H-03** | **Inventario Conceptual/Físico Inexacto:** Omisión de correspondencia 1:1. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md), [`VALIDATION_REPORT_v0.2.6.md`](VALIDATION_REPORT_v0.2.6.md) | Publicación de inventario automatizado confirmando 27 Entidades Únicas y 29 Tablas DDL. | `REMEDIADO` |
| **H-04** | **Informes de Validación con Falsos Positivos:** Afirmaciones sin logs ejecutables de respaldo. | [`VALIDATION_REPORT_v0.2.6.md`](VALIDATION_REPORT_v0.2.6.md) | `VALIDATION_REPORT_v0.2.6.md` alimentado directamente por la salida de ejecución del script `scratch/validate_v0.2.6.cjs`. | `REMEDIADO` |
| **H-05** | **Backlog No Acotado a Fase 1:** Inclusión de historias de fases posteriores en Fase 1. | [`docs/backlog/PHASE_1_BACKLOG.md`](docs/backlog/PHASE_1_BACKLOG.md) | Puertas de Calidad acotadas estrictamente a la fundación técnica. Inclusión de Definition of Done por historia. | `REMEDIADO` |
| **H-06** | **Canal de Sandbox PDF Incompleto:** Falta de especificación de canal IPC/tmpfs y motores DOCX/EPUB. | [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) | Especificación del canal IPC/tmpfs para Chromium e independización de motores nativos para `DOCX` y `EPUB`. | `REMEDIADO` |

---

## 4. Conclusión y Estado de Fase 0

Todos los hallazgos de las auditorías v0.2.0 a v0.2.5 han sido objeto de remediación real, efectiva y verificable en la versión `v0.2.6`. El paquete `politica-canon-v0.2.6.zip` queda listo para someterse a la auditoría externa final.

**Estado Actual:** `FASE 0 — PENDIENTE DE AUDITORÍA EXTERNA FINAL (v0.2.6)`
