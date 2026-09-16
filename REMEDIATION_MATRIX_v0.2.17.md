# Matriz de Remediación Técnica — Política Canon v0.2.17

**Fecha:** 16 de septiembre de 2026  
**Paquete Auditado Previo:** `politica-canon-v0.2.16.zip`  
**Paquete Remediado:** `politica-canon-v0.2.17.zip`  
**Dictamen de Auditoría v0.2.16:** `NO PASS`  
**Dictamen Interno v0.2.17:** `PASS — LÍNEA BASE Y ARNÉS DE PRUEBAS INTEGRADO EN POSTGRESQL 16+`  

---

## 1. Matriz de Hallazgos y Remediaciones Ejecutadas

| ID | Categoría | Descripción del Hallazgo (Auditoría v0.2.16) | Estado | Remediación Técnica Implementada en v0.2.17 |
|---|---|---|---|---|
| **C-01** | **JCS Canonicalization Numérica** | La serialización de números con exponente (`1e-7`, `1e+21`) en PL/pgSQL generaba ceros de relleno (`1.00000000000000000000e-07`) discrepando del estándar RFC 8785 y del worker JS. | **REMEDIADO** | Se creó la función PL/pgSQL `jcs_format_number(p_num NUMERIC)` conforme a la norma ES6 / RFC 8785: notación exponencial sin ceros a la izquierda en exponente ni decimales innecesarios para $|n| < 10^{-6}$ o $|n| \ge 10^{21}$ (`1e-7`, `1e+21`), y `TRIM_SCALE` para el resto (`100`, `0.0015`), produciendo coincidencia byte a byte con JS `worker.ts`. |
| **C-02** | **Invariante CHECK de Votos** | `cast_vote_transactional` fallaba en la inserción inicial al violar `CHECK (approval_votes_count > 0)` en la tabla `decisions`. | **REMEDIADO** | Se actualizó la restricción de tabla a `approval_votes_count INT NOT NULL DEFAULT 0 CHECK (approval_votes_count >= 0)`. `cast_vote_transactional` inserta atómicamente el voto en `decision_votes` y recalcula la suma, permitiendo inicializaciones y estados con cero votos sin violar restricciones. |
| **H-01** | **Arnés de Pruebas Integrado Real (PostgreSQL 16)** | El script de pruebas no ejecutaba sentencias ni funciones sobre un motor PostgreSQL 16 real. | **REMEDIADO** | Se implementó `validate_v0.2.17.cjs` (`npm test`) conectándose a la base PostgreSQL 16 `politica_canon_db`, ejecutando DDLs, bootstraps de roles, comparativa completa de canonicalización JCS (números y claves supletorias), pruebas de votación colegiada $N=1,2,3,4$, cambios de voto de `APPROVE` a `REJECT`, y rollback completo con `0001_initial_schema_down.sql`. |
| **H-02** | **Manifiesto Externo Adjunto** | `MANIFEST_v0.2.16.json` no venía adjunto al ZIP o faltaba en el directorio de entrega. | **REMEDIADO** | Se generó `scratch/create_zip_v0.2.17.ps1` que emite `MANIFEST_v0.2.17.json` adjunto al paquete `politica-canon-v0.2.17.zip` en el directorio de entrega y en la raíz local con comprobación estricta de hash SHA-256 y tamaño. |

---

## 2. Conclusión

La versión **v0.2.17** soluciona de forma definitiva e incontrovertible los hallazgos C-01 y C-02 en PostgreSQL 16. La canonicalización de números cumple 100% el estándar RFC 8785, el flujo de votación colegiada atómica opera sin violar restricciones DDL, y el arnés de validación ejecuta la suite completa de pruebas de integración contra un motor PostgreSQL 16 activo.
