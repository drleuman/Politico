# Matriz de Remediación Técnica — Política Canon v0.2.16

**Fecha:** 16 de septiembre de 2026  
**Paquete Auditado Previo:** `politica-canon-v0.2.15.zip`  
**Paquete Remediado:** `politica-canon-v0.2.16.zip`  
**Dictamen de Auditoría v0.2.15:** `NO PASS`  
**Dictamen Interno v0.2.16:** `PASS — LÍNEA BASE Y ARNÉS DE PRUEBAS INTEGRADO EN POSTGRESQL 16+`  

---

## 1. Matriz de Hallazgos y Remediaciones Ejecutadas

| ID | Categoría | Descripción del Hallazgo (Auditoría v0.2.15) | Estado | Remediación Técnica Implementada en v0.2.16 |
|---|---|---|---|---|
| **C-01** | **JCS Canonicalization en PostgreSQL 16** | `SELECT jcs_canonicalize_jsonb(...)` fallaba en PostgreSQL 16 con `invalid destination encoding name "UTF16BE"` debido a `convert_to(key, 'UTF16BE')`. | **REMEDIADO** | Se sustituyó `convert_to` por la función PL/pgSQL `jcs_utf16_sort_key(p_key TEXT)` que codifica claves BMP y supletorias Unicode (U+10000+) a hex de unidades de código UTF-16 BE, permitiendo ordenación RFC 8785 nativa y 100% compatible con PostgreSQL 16 sin depender de codificaciones no soportadas. |
| **C-02** | **Votación Atómica y Quórum Colegiado** | `cast_vote_transactional` no insertaba registros en `decision_votes`. `finalize_decision_transactional` permitía aprobar decisiones con 1 solo voto para 2 elegibles (`CEIL(2/2) = 1`). | **REMEDIADO** | Se modificó `cast_vote_transactional` para insertar/actualizar atómicamente votos en `decision_votes` previa verificación de sesión, MFA y rol APPROVER. Se actualizó `approve_decision_transactional` para contar los votos registrados en `decision_votes` y exigir mayoría estricta de elegibles (`v_approve_votes > v_total_eligible / 2.0`). Con 2 elegibles, 1 voto falla (`QUORUM_NOT_REACHED`) y se requieren 2; con 4 elegibles se requieren 3. |
| **H-01** | **Arnés de Pruebas Integrado Real (PostgreSQL 16)** | `validate_v0.2.15.cjs` realizaba búsquedas de texto y no ejecutaba DDLs ni funciones SQL contra PostgreSQL 16. | **REMEDIADO** | Se implementó `validate_v0.2.16.cjs` (`npm test`) que ejecuta DDLs, bootstraps de roles, funciones PL/pgSQL de canonicalización JCS, vectores complejas Unicode/exponenciales, pruebas de votación colegiada con 2, 3 y 4 elegibles, y reversibilidad DDL down en PostgreSQL 16. |
| **H-02** | **Manifiesto Externo Adjunto** | `MANIFEST_v0.2.15.json` no fue entregado junto al paquete ZIP o faltaba en la raíz. | **REMEDIADO** | Se automatizó la generación de `MANIFEST_v0.2.16.json` mediante `scratch/create_zip_v0.2.16.ps1`, emitiendo el manifiesto externo desacoplado en la raíz del proyecto y en el directorio de entrega junto a `politica-canon-v0.2.16.zip` con verificación exacta de SHA-256 y bytes. |
| **H-03** | **Reconciliación de Inventario Documental** | Inconsistencia entre 29 y 30 entidades/tablas en la documentación de línea base. | **REMEDIADO** | Se unificaron todas las referencias en los documentos vigentes (`README.md`, `docs/07_MODELO_DATOS.md`, `docs/00_INDICE_CANONICO_DOCUMENTAL.md`, `PHASE_0_FINAL_ACCEPTANCE.md`, etc.) a 30 Entidades Conceptuales Mermaid y 30 Tablas Físicas DDL. |

---

## 2. Conclusión

La versión **v0.2.16** subsana de manera definitiva todas las deficiencias señaladas en el dictamen externo de v0.2.15. La canonicalización JCS RFC 8785 funciona nativamente en PostgreSQL 16 sin errores de codificación, la votación es colegiada con inserción atómica de votos y exigencia estricta de mayoría, el arnés de pruebas ejecuta validaciones reales en PostgreSQL 16 y el manifiesto externo acompaña de forma determinista al empaquetado del release.
