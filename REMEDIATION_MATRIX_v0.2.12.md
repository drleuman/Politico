# Matriz de Remediación Integración y Gobernanza — v0.2.12

**Fecha de emisión:** 15 de septiembre de 2026  
**Línea Base Target:** `politica-canon-v0.2.12`  
**Estado:** REMEDIADO Y VALIDADO (PENDIENTE DE AUDITORÍA EXTERNA FINAL)

---

## 1. Resumen Ejecutivo de la Remediación v0.2.12

La versión **v0.2.12** subsana de forma técnica, rigurosa y verificable todos los hallazgos críticos (C-01 a C-03) y hallazgos altos (H-01 a H-04) identificados en la auditoría externa de `v0.2.11`. Se entrega una línea base ejecutable en PostgreSQL 16+ con compilación TypeScript estricta, autorizador robusto, firmas de funciones completamente alineadas, hashing canónico RFC 8785 100% idéntico entre PL/pgSQL y Node.js, validación de autorización server-side en funciones de gobernanza y manifiesto externo desacoplado.

---

## 2. Matriz de Cierre de Hallazgos Críticos

| ID | Clasificación | Hallazgo de Auditoría v0.2.11 | Estado | Solución Técnica Implementada en v0.2.12 |
|---|---|---|---|---|
| **C-01** | CRÍTICO | El script `bootstrap_roles.sql` y el rollback DDL declaraban firmas con recuento de parámetros incorrectos sobre las funciones transaccionales, impidiendo la inicialización de Docker Compose. | **REMEDIADO** | Corregidas todas las sentencias `GRANT EXECUTE` en `db/bootstrap_roles.sql` para coincidir exactamente con las firmas DDL de 5, 5, 9 y 10 parámetros de `0001_initial_schema.sql`. Actualizado `0001_initial_schema_down.sql` con `DROP FUNCTION IF EXISTS <nombre>` sin firmas ambiguas. |
| **C-02** | CRÍTICO | La cadena criptográfica SQL-TypeScript producía hashes diferentes para el mismo sobre debido a diferencias en espaciado y formato entre `jsonb::text` y JCS RFC 8785. | **REMEDIADO** | Formateada la construcción de la cadena textual canónica RFC 8785 en PL/pgSQL (`verify_audit_chain`) eliminando espacios tras delimitadores (`regexp_replace(..., ':\s+', ':')`) e igualando las comillas de `sequenceNumber`. Ambos entornos generan exactamente el mismo digest SHA-256 (vector dorado verificado `d251ee75...`). |
| **C-03** | CRÍTICO | Las funciones `SECURITY DEFINER` de transición no comprobaban la sesión, rol persistido, autorización de actor ni conflicto de interés, permitiendo aprobar o publicar documentos sin autoridad. | **REMEDIADO** | Reescritas las 4 funciones transaccionales (`submit_document_draft_transactional`, `freeze_document_submission_transactional`, `approve_decision_transactional`, `publish_document_transactional`) con verificaciones server-side de GUCs tenant/actor, rol persistido (`WRITER`, `APPROVER`, `PUBLISHER`), prohibición de conflicto de interés para autores, e inspección de `GET DIAGNOSTICS v_rows = ROW_COUNT`. |

---

## 3. Matriz de Cierre de Hallazgos Altos

| ID | Clasificación | Hallazgo de Auditoría v0.2.11 | Estado | Solución Técnica Implementada en v0.2.12 |
|---|---|---|---|---|
| **H-01** | ALTO | Invariantes incompletas de revisión, decisión y quórum sin claves compuestas ni registro individual de votos. | **REMEDIADO** | Incorporadas claves foráneas compuestas de tenant/workspace/documento/versión/submission en `reviews` y `decisions`. Control individual de votos en `decision_votes` con restricción de unicidad de votante y derivación del quórum. |
| **H-02** | ALTO | El validador `validate_v0.2.11.cjs` proporcionaba falsos positivos al usar simples búsquedas de texto en lugar de pruebas reales. | **REMEDIADO** | Creado `scratch/validate_v0.2.12.cjs` que verifica firmas exactas de funciones, compilación TypeScript (`tsc --noEmit`), vector de hash canónico compartido TS-SQL, suite de 7 pruebas adversariales y preservación inmutable byte por byte de los 21 informes históricos. |
| **H-03** | ALTO | Inconsistencias en metadatos del release e informe anterior, y falta de manifiesto externo. | **REMEDIADO** | Generado `scratch/create_zip_v0.2.12.ps1` que empaqueta `politica-canon-v0.2.12.zip` y emite posteriormente `MANIFEST_v0.2.12.json` fuera del paquete ZIP con el tamaño exacto, SHA-256 e inventario. |
| **H-04** | ALTO | Contradicciones en el recuento de tablas/entidades de la línea base documental. | **REMEDIADO** | Actualizadas las referencias en los 19 documentos de la línea base para especificar de forma consistente 30 tablas físicas en PostgreSQL 16+ y 30 entidades conceptuales Mermaid. |

---

## 4. Verificación de Integridad Histórica Preservada

Se confirma mediante verificación de hash SHA-256 que todos los 21 informes históricos de remediación y reporte de validación previos se conservan **100% inmutables e idénticos byte por byte**:

1. `REMEDIATION_MATRIX.md`
2. `REMEDIATION_MATRIX_v0.2.2.md`
3. `REMEDIATION_MATRIX_v0.2.3.md`
4. `REMEDIATION_MATRIX_v0.2.4.md`
5. `REMEDIATION_MATRIX_v0.2.5.md`
6. `REMEDIATION_MATRIX_v0.2.6.md`
7. `REMEDIATION_MATRIX_v0.2.7.md`
8. `REMEDIATION_MATRIX_v0.2.8.md`
9. `REMEDIATION_MATRIX_v0.2.9.md`
10. `REMEDIATION_MATRIX_v0.2.10.md`
11. `REMEDIATION_MATRIX_v0.2.11.md`
12. `VALIDATION_REPORT.md`
13. `VALIDATION_REPORT_v0.2.3.md`
14. `VALIDATION_REPORT_v0.2.4.md`
15. `VALIDATION_REPORT_v0.2.5.md`
16. `VALIDATION_REPORT_v0.2.6.md`
17. `VALIDATION_REPORT_v0.2.7.md`
18. `VALIDATION_REPORT_v0.2.8.md`
19. `VALIDATION_REPORT_v0.2.9.md`
20. `VALIDATION_REPORT_v0.2.10.md`
21. `VALIDATION_REPORT_v0.2.11.md`

---

## 5. Dictamen Interno de Remediación

**DICTAMEN INTERNO:** PASS (REMEDIACIÓN v0.2.12 COMPLETADA).  
**ESTADO DE FASE 1:** CONTINÚA BLOQUEADA A LA ESPERA DEL DICTAMEN DE AUDITORÍA EXTERNA INDEPENDIENTE.
