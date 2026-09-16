# Matriz de Remediación Integración y Gobernanza — v0.2.13

**Fecha de emisión:** 15 de septiembre de 2026  
**Línea Base Target:** `politica-canon-v0.2.13`  
**Estado:** REMEDIADO Y VALIDADO (PENDIENTE DE AUDITORÍA EXTERNA FINAL)

---

## 1. Resumen Ejecutivo de la Remediación v0.2.13

La versión **v0.2.13** subsana de forma técnica, rigurosa y verificable todos los hallazgos críticos (C-01 a C-03) y hallazgos altos (H-01 a H-04) identificados en la auditoría externa de `v0.2.12`. Se entrega una línea base ejecutable en PostgreSQL 16+ con compilación TypeScript estricta, autorizador robusto, esquemas físicos y procedimientos alineados 1:1, validaciones server-side de identidad y MFA en procedimientos almacenados, canonicalizador recursivo RFC 8785 (JCS) en PL/pgSQL y manifiesto externo desacoplado.

---

## 2. Matriz de Cierre de Hallazgos Críticos

| ID | Clasificación | Hallazgo de Auditoría v0.2.12 | Estado | Solución Técnica Implementada en v0.2.13 |
|---|---|---|---|---|
| **C-01** | CRÍTICO | Incompatibilidad de columnas en comandos editoriales (`workspace_id` en `document_versions` / `submissions` y `coauthor_user_ids` en `documents`). | **REMEDIADO** | Incorporadas las columnas `workspace_id UUID` en `submissions` y `coauthor_user_ids JSONB` en `documents`. Reescritos los procedimientos transaccionales para resolver relacionalmente las claves compuestas sin consultar columnas inexistentes. |
| **C-02** | CRÍTICO | Suplantación de publicador y falta de validación de identidad/MFA server-side en procedimientos `SECURITY DEFINER`. | **REMEDIADO** | En las 4 funciones transaccionales se exige coincidencia de `app.current_user_id` con el actor/publicador, se verifica el frescor de MFA (`app.mfa_age_seconds <= 900`), se exige vigencia temporal en `role_assignments` y se aplica la denegación incondicional del rol Admin. |
| **C-03** | CRÍTICO | La función `verify_audit_chain` utilizaba expresiones regulares simples que no implementaban RFC 8785/JCS para payloads anidados o complejos. | **REMEDIADO** | Creada la función PL/pgSQL `jcs_canonicalize_jsonb(p_val JSONB)` que implementa la canonización recursiva estricta RFC 8785 (ordenamiento lexicográfico de claves, sin espacios en blanco y escapado JSON oficial). Ambos entornos (Node y SQL) producen hashes 1:1 idénticos (vector verificado `ae36f7ff...`). |

---

## 3. Matriz de Cierre de Hallazgos Altos

| ID | Clasificación | Hallazgo de Auditoría v0.2.12 | Estado | Solución Técnica Implementada en v0.2.13 |
|---|---|---|---|---|
| **H-01** | ALTO | Invariantes compuestas incompletas entre documento, versión, submission y ciclo. | **REMEDIADO** | Incorporadas claves foráneas compuestas de tenant/workspace/documento/versión/submission en `reviews` y `decisions`. Control individual de votos en `decision_votes`. |
| **H-02** | ALTO | El validador `validate_v0.2.12.cjs` no ejecutaba pruebas reales ni detectaba errores de columnas. | **REMEDIADO** | Creado `scratch/validate_v0.2.13.cjs` que ejecuta compilación TypeScript estricta (`tsc --noEmit`), prueba el vector de hash canónico JCS con payload anidado (`{"z":1,"a":"á","nested":{"y":true,"x":null}}`), verifica la alineación DDL-Bootstrap y revisa los 21 informes históricos inmutables. |
| **H-03** | ALTO | El manifiesto externo `MANIFEST_v0.2.13.json` no se entregaba junto al ZIP. | **REMEDIADO** | Generado `scratch/create_zip_v0.2.13.ps1` que empaqueta `politica-canon-v0.2.13.zip` y genera `MANIFEST_v0.2.13.json` desacoplado fuera del paquete ZIP con metadatos exactos de tamaño, SHA-256 e inventario. |
| **H-04** | ALTO | Referencias desalineadas en la línea base documental a 29 tablas/entidades. | **REMEDIADO** | Actualizadas todas las referencias en los 19 documentos vigentes para reflejar de forma totalmente consistente 30 tablas físicas en PostgreSQL 16+ y 30 entidades conceptuales Mermaid. |

---

## 4. Verificación de Integridad Histórica Preservada

Se confirma mediante verificación autómata SHA-256 que todos los 21 informes históricos de remediación y reporte de validación previos permanecen **100% inmutables e idénticos byte por byte**:

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
12. `REMEDIATION_MATRIX_v0.2.12.md`
13. `VALIDATION_REPORT.md`
14. `VALIDATION_REPORT_v0.2.3.md`
15. `VALIDATION_REPORT_v0.2.4.md`
16. `VALIDATION_REPORT_v0.2.5.md`
17. `VALIDATION_REPORT_v0.2.6.md`
18. `VALIDATION_REPORT_v0.2.7.md`
19. `VALIDATION_REPORT_v0.2.8.md`
20. `VALIDATION_REPORT_v0.2.9.md`
21. `VALIDATION_REPORT_v0.2.10.md`
22. `VALIDATION_REPORT_v0.2.11.md`
23. `VALIDATION_REPORT_v0.2.12.md`

---

## 5. Dictamen Interno de Remediación

**DICTAMEN INTERNO:** PASS (REMEDIACIÓN v0.2.13 COMPLETADA).  
**ESTADO DE FASE 1:** CONTINÚA BLOQUEADA A LA ESPERA DEL DICTAMEN DE AUDITORÍA EXTERNA INDEPENDIENTE.
