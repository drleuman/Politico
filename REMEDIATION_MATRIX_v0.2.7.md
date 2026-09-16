# Matriz de Remediación Byte-by-Byte de la Auditoría v0.2.6 — Política Canon v0.2.7

**Fecha:** 15 de septiembre de 2026  
**Versión Target:** `politica-canon-v0.2.7`  
**Estado:** `REMEDIADO Y VALIDADO (PENDIENTE DE AUDITORÍA EXTERNA FINAL)`  
**Auditoría Precedente:** Audit Report v0.2.6 (Dictamen: `NO PASS`)  

---

## 1. Resumen de Estado de Remediación v0.2.7

| Hallazgo Auditado | Categoría | Estado | Solución Aplicada en v0.2.7 | Archivo Modificado / Evidencia |
|---|---|---|---|---|
| **C-01** | Crítico | **REMEDIADO** | Se crearon explícitamente 25 sentencias `CREATE POLICY tenant_isolation_policy ON ... USING (...) WITH CHECK (...)` para todas las tablas tenant-scoped en `ERD.md`. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md#L430-L465) |
| **C-02** | Crítico | **REMEDIADO** | La función `grant_governance_role_transactional(p_organization_id, p_request_id)` valida 4 identidades distintas, comprobación activa en `GOVERNANCE_REGISTRY`, expiración `expires_at`, `SECURITY DEFINER SET search_path` y revocación a `PUBLIC` y a `app_user`. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md#L471-L545) |
| **C-03** | Crítico | **REMEDIADO** | Se eliminaron banderas de confianza y aprobaciones precargadas del DTO de entrada `AuthorizationRequest`. El contexto resuelto se hidrata internamente en servidor. | [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md#L80-L105) |
| **C-04** | Crítico | **REMEDIADO** | Se corrigieron evaluaciones de fechas con validación finitica (`!isNaN(Date.parse(validUntil))`), asignación nominal en borrador, y lectura pública anónima permitida sin org ID. | [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md#L106-L170) |
| **C-05** | Crítico | **REMEDIADO** | Se especificó el código ejecutable del worker outbox (`FOR UPDATE SKIP LOCKED`), leasing recuperable, retries (`retry_count >= 0`), dead-letter queue, canonicalización RFC 8785 (JCS), Genesis Hash (64 ceros) y verificador SQL. | [`docs/adr/ADR-0003-audit-logging-and-outbox.md`](docs/adr/ADR-0003-audit-logging-and-outbox.md#L1-L150) |
| **C-06** | Crítico | **REMEDIADO** | Se incluyó el script ejecutable `scratch/validate_v0.2.7.cjs` dentro del paquete del repositorio ZIP para reproducibilidad 100% autotenida. | [`scratch/validate_v0.2.7.cjs`](scratch/validate_v0.2.7.cjs) |
| **C-07** | Crítico | **REMEDIADO** | Se unificaron las versiones de todos los documentos activos a `0.2.7` manteniendo 100% inmutables e inalterados los informes históricos pasados. | [`README.md`](README.md), [`CHANGELOG.md`](CHANGELOG.md), [`docs/00_INDICE_CANONICO_DOCUMENTAL.md`](docs/00_INDICE_CANONICO_DOCUMENTAL.md) |
| **H-01** | Alto | **REMEDIADO** | Se impusieron FKs compuestas multi-tenant `(organization_id, publication_id)` y `(organization_id, decision_id)` en `publication_events` y `replaced_publication_id`. | [`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md#L35-L60), [`docs/architecture/ERD.md`](docs/architecture/ERD.md#L270-L290) |
| **H-02** | Alto | **REMEDIADO** | Se modificó la clave foránea `working_drafts.base_version_id` a `ON DELETE RESTRICT` manteniendo `organization_id NOT NULL`. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md#L188-L198) |
| **H-03** | Alto | **REMEDIADO** | Se reforzaron las relaciones tenant mediante FKs compuestas que incluyen `organization_id` en `audit_events`, `audit_outbox_dead_letter`, `publications` y `publication_events`. | [`docs/architecture/ERD.md`](docs/architecture/ERD.md#L387-L426) |
| **H-04** | Alto | **REMEDIADO** | Se restauraron y especificaron los contratos funcionales de datasets, búsqueda, notificaciones e indicadores en el PRD, aclarando renderizado PDF Chromium vs DOCX/EPUB nativo. | [`docs/01_PRD.md`](docs/01_PRD.md#L15-L60) |
| **H-05** | Alto | **REMEDIADO** | Se acotó el backlog de Fase 1 a los objetivos de fundación técnica, moviendo las puertas de impresión PDF a Fase 5 e incluyendo Criterios de Aceptación y DoD por historia. | [`docs/backlog/PHASE_1_BACKLOG.md`](docs/backlog/PHASE_1_BACKLOG.md#L1-L80) |
| **H-06** | Alto | **REMEDIADO** | Se especificó el comando ejecutable del sandbox Chromium con image digest, banderas CLI locales, tubería STDIN/STDOUT, timeout (10s) y límite de salida (10MB). | [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md#L28-L55) |
| **H-07** | Alto | **REMEDIADO** | Se generó la empaquetación del ZIP `politica-canon-v0.2.7.zip` utilizando separadores POSIX `/` en todas las entradas de archivos para compatibilidad con Plesk/Linux. | [`scratch/create_zip_v0.2.7.ps1`](scratch/create_zip_v0.2.7.ps1) |

---

## 2. Declaración de Cierre de Fase 0

Con la remediación ejecutable de la totalidad de los hallazgos C-01 a C-07 y H-01 a H-07, la versión **v0.2.7** queda presentada para dictamen de auditoría externa final.
