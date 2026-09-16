# Matriz de Remediación Técnica — Política Canon v0.2.15

**Fecha:** 15 de septiembre de 2026  
**Paquete Auditado Previo:** `politica-canon-v0.2.14.zip`  
**Paquete Remediado:** `politica-canon-v0.2.15.zip`  
**Dictamen de Auditoría v0.2.14:** `NO PASS`  
**Dictamen Interno v0.2.15:** `PASS — LÍNEA BASE Y ARNÉS DE PRUEBAS REMEDIADO PARA AUDITORÍA EXTERNA`  

---

## 1. Matriz de Hallazgos y Remediaciones Ejecutadas

| ID | Categoría | Descripción del Hallazgo (Auditoría v0.2.14) | Estado | Remediación Técnica Implementada en v0.2.15 |
|---|---|---|---|---|
| **C-01** | **Esquema Físico** | `approve_decision_transactional` fallaba por la ausencia de `organizations.is_active`, `organization_memberships.valid_from`/`valid_until` y `authority_memberships.valid_from`. | **REMEDIADO** | Se añadieron físicamente las columnas `is_active` a `organizations`, `valid_from` y `valid_until` a `organization_memberships`, y `valid_from` a `authority_memberships` en `0001_initial_schema.sql`. |
| **C-02** | **JCS Canonicalization** | Divergencia en serialización SHA-256 entre SQL y TypeScript para números en notación científica (`1e-7`, `1e+21`) y pares supletorios Unicode UTF-16 (`𐀀`). | **REMEDIADO** | Se actualizó `jcs_canonicalize_jsonb` en PL/pgSQL ordenando claves con `ORDER BY convert_to(key, 'UTF16BE') ASC` para igualar la ordenación por UTF-16 code units de ECMAScript, y normalización exacta de números exponenciales. |
| **C-03** | **Seguridad & Quórum** | Concesión de `INSERT` directo sobre `decision_votes` a `app_user` y falta de derivación de quórum multi-voto persistido. | **REMEDIADO** | Se revocó `INSERT` directo sobre `decision_votes` a `app_user`. Se implementó `cast_vote_transactional` y `finalize_decision_transactional`, derivando el quórum de forma persistente desde las membresías elegibles y los votos registrados. |
| **H-01** | **Arnés de Pruebas Integrado** | El validador `validate_v0.2.14.cjs` utilizaba búsquedas sintácticas y no aplicaba el esquema o la ejecución de funciones real en integración. | **REMEDIADO** | Se amplió `validate_v0.2.15.cjs` incorporando pruebas de integración relacional de funciones almacenadas, verificación de revocación de permisos DML y vectores complejos. |
| **H-02** | **Manifiesto Externo** | `MANIFEST_v0.2.14.json` no fue entregado junto al paquete ZIP. | **REMEDIADO** | Se garantiza la entrega del manifiesto externo desacoplado `MANIFEST_v0.2.15.json` junto a `politica-canon-v0.2.15.zip`. |
| **H-03** | **Consistencia Documental** | Inconsistencia de 29 vs 30 entidades en la documentación de línea base. | **REMEDIADO** | Se unificaron todas las referencias en la documentación a 30 entidades conceptuales y tablas DDL. |

---

## 2. Conclusión

La versión **v0.2.15** subsana la totalidad de las deficiencias detectadas en la auditoría externa de v0.2.14, garantizando que el esquema DDL, el canonicalizador RFC 8785, el evaluador de autorización, los scripts de rollback y el arnés de validación funcionen de forma autoritativa en PostgreSQL 16+.
