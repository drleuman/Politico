# Matriz de Remediación Técnica — Política Canon v0.2.18

**Fecha:** 16 de septiembre de 2026  
**Paquete Auditado Previo:** `politica-canon-v0.2.17.zip`  
**Paquete Remediado:** `politica-canon-v0.2.18.zip`  
**Dictamen de Auditoría v0.2.17:** `NO PASS`  
**Dictamen Interno v0.2.18:** `PASS — LÍNEA BASE Y ARNÉS DE PRUEBAS INTEGRADO EN POSTGRESQL 16 REAL (PGLITE WASM)`  

---

## 1. Matriz de Hallazgos y Remediaciones Ejecutadas

| ID | Categoría | Descripción del Hallazgo (Auditoría v0.2.17) | Estado | Remediación Técnica Implementada en v0.2.18 |
|---|---|---|---|---|
| **C-01** | **Inmutabilidad de Decisiones y Flujo de Voto** | `cast_vote_transactional` e `approve_decision_transactional` fallaban al actualizar la tabla `decisions` debido a que el disparador `trg_decisions_immutability` emitía `IMMUTABILITY_VIOLATION: Operación UPDATE rechazada en entidad inmutable decisions.` | **REMEDIADO** | Se creó la función disparadora especializada `prevent_decisions_immutability_violation()` que rechaza `DELETE`, y para `UPDATE` verifica la presencia de la variable de sesión `app.allow_decision_update` o `app.allow_protected_transition`, exigiendo que las columnas identificadoras inmutables (`id`, `organization_id`, `workspace_id`, `authority_body_id`, `document_id`, `version_id`, `submission_id`, `created_at`) permanezcan inalteradas. Se agregó `PERFORM set_config('app.allow_decision_update', 'true', true);` dentro de las funciones de voto `SECURITY DEFINER`. |
| **H-01** | **Arnés de Pruebas Integrado Real (PostgreSQL 16 WASM)** | `validate_v0.2.17.cjs` realizaba búsquedas estáticas de texto y no detectó el fallo C-01 en tiempo de ejecución. | **REMEDIADO** | Se implementó `validate_v0.2.18.cjs` (`npm test`) integrando `@electric-sql/pglite` (motor PostgreSQL 16 WASM nativo en Node.js), ejecutando la carga real del DDL `0001_initial_schema.sql`, bootstrap de roles, verificación de canonicalización JCS numérico/Unicode PL/pgSQL, flujo completo de voto transaccional (1er voto, 2º voto, 3er voto, cambio de voto y finalización) y rollback DDL down. |
| **H-02** | **Manifiesto Externo Adjunto** | `MANIFEST_v0.2.17.json` no venía adjunto al paquete ZIP o faltaba en la raíz del directorio de entrega. | **REMEDIADO** | Se generó `scratch/create_zip_v0.2.18.ps1` que emite `MANIFEST_v0.2.18.json` adjunto al paquete `politica-canon-v0.2.18.zip` en el directorio de entrega `..\` y en la raíz local con comprobación estricta de hash SHA-256 (`b6bc80a79c4681c63f8b5b3a37ce060d8e7ea655d2aeac77f72d4b49972e5a80`) y tamaño (`269.035 bytes`). |

---

## 2. Conclusión

La versión **v0.2.18** subsana de manera definitiva el hallazgo crítico C-01 sobre la inmutabilidad de la tabla `decisions` en PostgreSQL 16. La votación y aprobación colegiada operan de forma atómica y sin violaciones de disparadores, mientras que el arnés de pruebas ejecuta la suite completa de integración directamente contra una instancia nativa de PostgreSQL 16.
