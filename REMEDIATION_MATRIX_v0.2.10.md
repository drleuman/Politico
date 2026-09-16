# Matriz de Remediación Integración y Gobernanza — v0.2.10

**Fecha de emisión:** 15 de septiembre de 2026  
**Línea Base Target:** `politica-canon-v0.2.10`  
**Estado:** REMEDIADO Y VALIDADO (PENDIENTE DE AUDITORÍA EXTERNA FINAL)

---

## 1. Resumen Ejecutivo de la Remediación v0.2.10

La versión **v0.2.10** subsana de forma definitiva y exhaustiva todos los hallazgos críticos (C-01 a C-05) y hallazgos altos (H-01 a H-05) documentados en la auditoría externa de `v0.2.9`. Se logra una línea base técnica ejecutable, reproducible y verificable de extremo a extremo sin ampliar el alcance del producto.

---

## 2. Matriz de Cierre de Hallazgos Críticos

| ID | Clasificación | Hallazgo de Auditoría v0.2.9 | Estado | Solución Técnica Implementada en v0.2.10 |
|---|---|---|---|---|
| **C-01** | CRÍTICO | Los verificadores de cadena producían falsos válidos: el SQL no recalculaba hashes SHA-256 en PL/pgSQL y el TypeScript perdía el tenant RLS por falta de transacción explícita `BEGIN...COMMIT`. | **REMEDIADO** | Incorporada recalculación criptográfica SHA-256 en PL/pgSQL con `pgcrypto` en `verify_audit_chain`. Actualizado `verifyAuditChainCrypted` en `src/audit/worker.ts` encerrando `set_config` y la consulta en una transacción explícita `BEGIN...COMMIT` y retornando `NO_ACCESSIBLE_EVENTS_FOR_TENANT`. Pruebas de alteración de hash y secuencia añadidas. |
| **C-02** | CRÍTICO | El autorizador ignoraba ámbitos efectivos en `PUBLISH`, no denegaba Admin si venía de `effectiveRoleAssignments`, aceptaba `AUDITOR` sin asignación persistida y `APPROVER` carecía de `target_authority_body_id`. | **REMEDIADO** | `evaluateAuthorizationContract` valida `ra.scopeId === resource.workspaceId` en `PUBLISH`, inspecciona `effectiveRoleAssignments` para la prohibición incondicional de Admin, exige asignación persistida para `AUDITOR` y valida el ámbito de `APPROVER`. Añadida la columna `target_authority_body_id` en `role_assignment_requests` y DDL SQL. |
| **C-03** | CRÍTICO | Las transiciones editoriales podían saltarse en base de datos mediante `UPDATE documents SET status = 'PUBLISHED'`. Invariantes sin ligazón a submissions. | **REMEDIADO** | Añadido trigger BEFORE UPDATE `trg_protect_document_status` en `documents` que deniega mutaciones directas de `status` fuera de funciones transaccionales protegidas. Revocada actualización directa de `status` a `app_user`. Enlazadas `decisions` y `reviews` a `submissions` y ciclos. |
| **C-04** | CRÍTICO | Funciones elevadas expuestas a `PUBLIC` y `get_pending_outbox_tenants()` concedida a `app_user` filtrando metadatos de tenants. | **REMEDIADO** | Ejecutado `REVOKE ALL ON FUNCTION ... FROM PUBLIC` para todas las funciones SECURITY DEFINER. Revocada `get_pending_outbox_tenants()` a `app_user` y restringida explícitamente al rol `audit_worker`. |
| **C-05** | CRÍTICO | `app_owner` no era propietario del esquema ni de las 29 tablas y funciones. | **REMEDIADO** | Añadidas sentencias `ALTER SCHEMA public OWNER TO app_owner`, `ALTER TABLE ... OWNER TO app_owner` para las 29 tablas y `ALTER FUNCTION ... OWNER TO app_owner` en `bootstrap_roles.sql`. |

---

## 3. Matriz de Cierre de Hallazgos Altos

| ID | Clasificación | Hallazgo de Auditoría v0.2.9 | Estado | Solución Técnica Implementada en v0.2.10 |
|---|---|---|---|---|
| **H-01** | ALTO | El validador aceptaba SQL deliberadamente inválido al usar búsquedas de texto simples y no ejecutaba `tsc --noEmit`. | **REMEDIADO** | Reescribo `scratch/validate_v0.2.10.cjs` ejecutando `npm run typecheck` (`tsc --noEmit`), suite de autorización con pruebas de denegación adversarial, outbox hash, y comprobación criptográfica estricta SHA-256 byte por byte de los 17 informes históricos (`v0.2.1` a `v0.2.9`). |
| **H-02** | ALTO | Los scripts npm no ejecutaban TypeScript y no existía `package-lock.json`. | **REMEDIADO** | Actualizado `package.json` con `"typecheck": "tsc --noEmit"`, `"build": "tsc"`, y generado `package-lock.json` versionado determinista. |
| **H-03** | ALTO | Metadatos de release en informe pretendían autocontener el hash del propio ZIP. | **REMEDIADO** | Generado `MANIFEST_v0.2.10.json` con el inventario físico, tamaño y SHA-256 externo validado tras el empaquetado final del ZIP. |
| **H-04** | ALTO | Mínimo privilegio incompleto en `app_user` y `audit_worker` (concedía escrituras amplias e incluso DELETE en auditoría). | **REMEDIADO** | Revocadas escrituras directas a `app_user` en entidades sensibles. Revocado `DELETE` en `audit_events` a `audit_worker`. |
| **H-05** | ALTO | Rollback de roles ausente y fallback del worker ocultaba fallos de configuración. | **REMEDIADO** | Creado `db/bootstrap_roles_down.sql` para rollback explícito de infraestructura de roles. Eliminado el fallback silencioso en `src/audit/worker.ts` para fallar cerrado si la función de worker es inaccesible. |

---

## 4. Verificación de Integridad Histórica Preservada

Se verifica de forma autónoma mediante SHA-256 que los 17 informes de remediación y reporte de validación previos permanecen **100% inmutables e idénticos byte por byte**:

1. `REMEDIATION_MATRIX.md`: `6E9D49F36DCC4E144D3A48B3BD910017BF871548FAB38FE0171242B318364FA0`
2. `REMEDIATION_MATRIX_v0.2.2.md`: `1D5E1E1EDB6D18D0C7E3ADF21C2CA46F2C6CDD51A56A47D2B42D52C798822C17`
3. `REMEDIATION_MATRIX_v0.2.3.md`: `4BCEE14F357606991E651E5483B2DCB27F60D43A23E2D2029C3BE8920ECF8674`
4. `REMEDIATION_MATRIX_v0.2.4.md`: `9282F111E0D24D882BD1A62CBD8D31A2BF1436F124F4904AFC7A6C2A0E8DE54E`
5. `REMEDIATION_MATRIX_v0.2.5.md`: `624C6178CC8D3210D5073196A0EF3C60E7C443568707CC21B1F732EE9C37F5A8`
6. `REMEDIATION_MATRIX_v0.2.6.md`: `7F6008DC9D61E9751965F927B57458EF473E355EF9E1832718D8ADA5E2EE4AD5`
7. `REMEDIATION_MATRIX_v0.2.7.md`: `BC0575070FBD1AE5D53A97F42DD8562EE359BB99EE7F1DBEC30DFFAB2486F0F8`
8. `REMEDIATION_MATRIX_v0.2.8.md`: `2DF9F0F508B869EB963E75BAFD018E42461E82E7D6094B56A753BEE94AC269A7`
9. `REMEDIATION_MATRIX_v0.2.9.md`: `9A2D11E3C214C8D3E1FD8F6C73AF612B58C891FF3C1D6D0D38D41E648EB47969`
10. `VALIDATION_REPORT.md`: `DF4FF25CE327B8C95DC49BF76A76BB9CE25D599B89C02F08B1A447C3F8C2AA83`
11. `VALIDATION_REPORT_v0.2.3.md`: `3857BD436B09253A9B1FEC7B0EF60A46DE07CB123F0A1069ED8035116695CFD4`
12. `VALIDATION_REPORT_v0.2.4.md`: `CE78E080A70032A9C2885DB6AF52723D70CA471ED76BF2C3BD86F52EA3F1488D`
13. `VALIDATION_REPORT_v0.2.5.md`: `1EDE48E4226A33B1D23F695591AE32ECC0686BCBE696AED5487297B61188A5D4`
14. `VALIDATION_REPORT_v0.2.6.md`: `EE396FC12D5C45D198596BFF90DD9454D27B446A20E3721FD654ABB2EBF94E5F`
15. `VALIDATION_REPORT_v0.2.7.md`: `2262010D22AC958EFEAC14BAF11152CF3FC81324CFBEFA674483B79EE75278CD`
16. `VALIDATION_REPORT_v0.2.8.md`: `0B627A9ACD9E274F1B93CC3AA9433511EDD70496C4FA9602B38B84943AE9FFA8`
17. `VALIDATION_REPORT_v0.2.9.md`: `94950D7A1548A59FEC2C0BC7F8FF2D054AB862756D9D543DD662C96AA5EB86A5`

---

## 5. Dictamen Interno de Remediación

**DICTAMEN INTERNO:** PASS (REMEDIACIÓN v0.2.10 COMPLETADA).  
**ESTADO DE FASE 1:** CONTINÚA BLOQUEADA A LA ESPERA DEL DICTAMEN DE AUDITORÍA EXTERNA INDEPENDIENTE.
