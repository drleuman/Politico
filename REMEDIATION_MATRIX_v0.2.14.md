# Matriz de Remediación Técnica — Política Canon v0.2.14

**Fecha:** 15 de septiembre de 2026  
**Paquete Auditado Previo:** `politica-canon-v0.2.13.zip`  
**Paquete Remediado:** `politica-canon-v0.2.14.zip`  
**Dictamen de Auditoría v0.2.13:** `NO PASS`  
**Dictamen Interno v0.2.14:** `PASS — LÍNEA BASE Y ARNÉS DE PRUEBAS REMEDIADO PARA AUDITORÍA EXTERNA`  

---

## 1. Matriz de Hallazgos y Remediaciones Ejecutadas

| ID | Categoría | Descripción del Hallazgo (Auditoría v0.2.13) | Estado | Remediación Técnica Implementada en v0.2.14 |
|---|---|---|---|---|
| **C-01** | **Esquema Físico** | `submit_document_draft_transactional` fallaba por consulta a `workspace_id` en `document_versions`. | **REMEDIADO** | Se añadió la columna física `workspace_id UUID NOT NULL` a `document_versions` con clave foránea compuesta hacia `documents(organization_id, workspace_id, id)`. |
| **C-02** | **JCS Canonicalization** | Divergencia en serialización SHA-256 entre SQL y TypeScript para números en notación exponencial y claves ordenadas con Unicode. | **REMEDIADO** | Se actualizó `jcs_canonicalize_jsonb` en PL/pgSQL utilizando `ORDER BY key COLLATE "C" ASC` para igualar el orden UTF-8/UTF-16 de JS y normalización precisa de valores numéricos. |
| **C-03** | **Seguridad & Quórum** | En `approve_decision_transactional`, un usuario con organización inactiva, membresía expirada y rol literal `MEMBER` podía aprobar. | **REMEDIADO** | Se añadieron validaciones server-side obligatorias para `organizations.is_active = true`, `organization_memberships` activo y en vigencia temporal, y verificación estricta del rol `APPROVER` (rechazando `MEMBER`). |
| **H-01** | **Rollback Cleanup** | El script de rollback `0001_initial_schema_down.sql` dejaba 2 funciones auxiliares en el esquema (`jcs_canonicalize_jsonb` y `check_mfa_freshness`). | **REMEDIADO** | Se añadieron sentencias `DROP FUNCTION IF EXISTS jcs_canonicalize_jsonb CASCADE;` y `DROP FUNCTION IF EXISTS check_mfa_freshness CASCADE;` en `0001_initial_schema_down.sql`. |
| **H-02** | **Configuración Release** | `package.json` conservaba la versión `0.2.12` y `npm test` ejecutaba el validador antiguo `validate_v0.2.12.cjs`. | **REMEDIADO** | Se actualizó `package.json` a `"version": "0.2.14"` y el script `"test": "node validate_v0.2.14.cjs"`. |
| **H-03** | **Integridad Histórica** | Necesidad de preservar intactos los 21 informes de auditoría histórica (`v0.2.1` a `v0.2.13`). | **REMEDIADO** | Se verificaron los hashes criptográficos SHA-256 de los 21 informes históricos, manteniéndolos 100% intactos byte por byte. |
| **H-04** | **Manifiesto Externo** | Entrega desacoplada del manifiesto `MANIFEST_v0.2.14.json` fuera del paquete ZIP. | **REMEDIADO** | Generación automatizada de `MANIFEST_v0.2.14.json` entregado en la raíz externa tras crear el archivo comprimido. |

---

## 2. Conclusión

La versión **v0.2.14** subsana la totalidad de las deficiencias detectadas en la auditoría externa de v0.2.13, garantizando que el esquema DDL, el canonicalizador RFC 8785, el evaluador de autorización, los scripts de rollback y el arnés de validación funcionen de forma autoritativa en PostgreSQL 16+.
