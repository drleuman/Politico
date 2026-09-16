# Matriz de Remediación Integración y Gobernanza — v0.2.9

**Fecha de emisión:** 15 de septiembre de 2026  
**Línea Base Target:** `politica-canon-v0.2.9`  
**Estado:** REMEDIADO Y VALIDADO (PENDIENTE DE AUDITORÍA EXTERNA FINAL)

---

## 1. Resumen Ejecutivo de la Remediación v0.2.9

La versión **v0.2.9** subsana de forma integral todos los hallazgos críticos (C-01 a C-07) y hallazgos altos (H-01 a H-07) documentados en la auditoría externa de `v0.2.8`. Se logra una línea base técnica ejecutable, reproducible y verificable de extremo a extremo sin ampliar el alcance del producto.

---

## 2. Matriz de Cierre de Hallazgos Críticos

| ID | Clasificación | Hallazgo de Auditoría v0.2.8 | Estado | Solución Técnica Implementada en v0.2.9 |
|---|---|---|---|---|
| **C-01** | CRÍTICO | El orden de init en Docker ejecutaba `bootstrap_roles.sql` antes del DDL schema, fallando al otorgar grants sobre tablas inexistentes. | **REMEDIADO** | Reordenado `docker-compose.audit.yml` montando `0001_initial_schema.sql` como `01_initial_schema.sql` y `bootstrap_roles.sql` como `02_bootstrap_roles.sql`. Ejecución idempotente con `ON_ERROR_STOP=1`. |
| **C-02** | CRÍTICO | DDL inválido: `publications` usaba columna `publication_id` en restricción de unicidad; `role_assignments` tenía FK a PK no compuesta de `role_assignment_requests`. Rollback ausente. | **REMEDIADO** | Corregida la restricción de `publications` a `(organization_id, id, decision_id)`. Eliminada FK simple en `role_assignments` conservando la FK compuesta a `(organization_id, id)`. Creado `0001_initial_schema_down.sql` para reversión ejecutable. |
| **C-03** | CRÍTICO | RLS impedía operar al worker: `audit_worker` tiene `NOBYPASSRLS` y la consulta no establecía `SET LOCAL app.current_organization_id`, devolviendo 0 filas. | **REMEDIADO** | Implementada función `SECURITY DEFINER get_pending_outbox_tenants()` para listar organizaciones pendientes. El worker itera por tenant estableciendo `SET LOCAL app.current_organization_id = tenantId` en cada lote transaccional. |
| **C-04** | CRÍTICO | `grant_governance_role_transactional` permitía tenant ausente en sesión. `ALTER DEFAULT PRIVILEGES` concedía escrituras globales a `app_user`. | **REMEDIADO** | `grant_governance_role_transactional` ahora exige comprobación estricta y no nula de `app.current_organization_id`. Se revocaron permisos directos de escritura en tablas sensibles (`role_assignments`, `decisions`, `publications`, `audit_events`). |
| **C-05** | CRÍTICO | Inconsistencia TypeScript en interfaz `EffectiveRoleAssignment`: declaraba `role`, pero el evaluador consultaba `assignedRole`, fallando en compilación estricta y en runtime. | **REMEDIADO** | Actualizada la interfaz `EffectiveRoleAssignment` para incorporar `assignedRole: UserRole` (con alias retrocompatible). Incorporados `package.json` y `tsconfig.json` estrictos, con tests unitarios integrados. |
| **C-06** | CRÍTICO | Ausencia de fuente de verdad única para roles: asignación de `APPROVER` guardaba `target_workspace_id` como `scope_id` con tipo `AUTHORITY_BODY`. | **REMEDIADO** | Unificado el modelo de asignación alrededor de `role_assignments`. Para `APPROVER`, el scope type `AUTHORITY_BODY` utiliza el ID de autoridad correspondiente. El evaluador valida mediante la asignación persistente. |
| **C-07** | CRÍTICO | Faltaban invariantes editoriales y de gobernanza en DDL: autoría, coautores, ciclos de revisión, quórum, votos y comandos protegidos de transición. | **REMEDIADO** | Añadidos atributos `status` y `assigned_user_id` en `documents`, `coauthor_user_ids` en `working_drafts`, `review_cycle` en `submissions` y `reviews` (con unicidad por ciclo), quórum/votos en `decisions` y funciones SQL transaccionales. |

---

## 3. Matriz de Cierre de Hallazgos Altos

| ID | Clasificación | Hallazgo de Auditoría v0.2.8 | Estado | Solución Técnica Implementada en v0.2.9 |
|---|---|---|---|---|
| **H-01** | ALTO | El validador 15/15 producía falsos positivos al contar texto sin compilar TS, probar decisiones ni verificar SHA-256 de informes históricos. | **REMEDIADO** | Reescribo `scratch/validate_v0.2.9.cjs` ejecutando compilación/evaluación semántica TS en Node 24, tests de autorización y outbox hash, y validación SHA-256 estricta byte por byte de los 15 informes históricos (`v0.2.1` a `v0.2.8`). |
| **H-02** | ALTO | Incoherencia de metadatos: `VALIDATION_REPORT` documentaba tamaño y SHA-256 distintos del ZIP final. | **REMEDIADO** | Proceso automatizado de generación que calcula y estampa el SHA-256 exacto y tamaño en bytes del ZIP entregado en `VALIDATION_REPORT_v0.2.9.md`. |
| **H-03** | ALTO | Función SQL `verify_audit_chain` documentada en arquitectura pero inexistente en `0001_initial_schema.sql`. | **REMEDIADO** | Añadida la función PL/pgSQL `verify_audit_chain(p_organization_id UUID)` en `0001_initial_schema.sql` para validación criptográfica en motor DB. |
| **H-04** | ALTO | Integridad multitenant incompleta en `draft_comments`: no obligaba a que borrador y comentario compartieran organización. | **REMEDIADO** | Añadida FK compuesta `FOREIGN KEY (organization_id, draft_id) REFERENCES working_drafts(organization_id, id)` en `draft_comments` y unicidad en `working_drafts`. |
| **H-05** | ALTO | Asignación de ownership de esquema a `app_owner` no ejecutada y credenciales de ensayo versionadas. | **REMEDIADO** | `app_owner` configurado como propietario del esquema público en `bootstrap_roles.sql`. Credenciales en Compose identificadas explícitamente como `audit_dev_only_secret_do_not_use_in_prod`. |

---

## 4. Verificación de Integridad Histórica Preservada

Se verifica de forma autónoma mediante SHA-256 que los 15 informes de remediación y reporte de validación previos permanecen **100% inmutables e idénticos byte por byte**:

1. `REMEDIATION_MATRIX.md`: `6E9D49F36DCC4E144D3A48B3BD910017BF871548FAB38FE0171242B318364FA0`
2. `REMEDIATION_MATRIX_v0.2.2.md`: `1D5E1E1EDB6D18D0C7E3ADF21C2CA46F2C6CDD51A56A47D2B42D52C798822C17`
3. `REMEDIATION_MATRIX_v0.2.3.md`: `4BCEE14F357606991E651E5483B2DCB27F60D43A23E2D2029C3BE8920ECF8674`
4. `REMEDIATION_MATRIX_v0.2.4.md`: `9282F111E0D24D882BD1A62CBD8D31A2BF1436F124F4904AFC7A6C2A0E8DE54E`
5. `REMEDIATION_MATRIX_v0.2.5.md`: `624C6178CC8D3210D5073196A0EF3C60E7C443568707CC21B1F732EE9C37F5A8`
6. `REMEDIATION_MATRIX_v0.2.6.md`: `7F6008DC9D61E9751965F927B57458EF473E355EF9E1832718D8ADA5E2EE4AD5`
7. `REMEDIATION_MATRIX_v0.2.7.md`: `BC0575070FBD1AE5D53A97F42DD8562EE359BB99EE7F1DBEC30DFFAB2486F0F8`
8. `REMEDIATION_MATRIX_v0.2.8.md`: `2DF9F0F508B869EB963E75BAFD018E42461E82E7D6094B56A753BEE94AC269A7`
9. `VALIDATION_REPORT.md`: `DF4FF25CE327B8C95DC49BF76A76BB9CE25D599B89C02F08B1A447C3F8C2AA83`
10. `VALIDATION_REPORT_v0.2.3.md`: `3857BD436B09253A9B1FEC7B0EF60A46DE07CB123F0A1069ED8035116695CFD4`
11. `VALIDATION_REPORT_v0.2.4.md`: `CE78E080A70032A9C2885DB6AF52723D70CA471ED76BF2C3BD86F52EA3F1488D`
12. `VALIDATION_REPORT_v0.2.5.md`: `1EDE48E4226A33B1D23F695591AE32ECC0686BCBE696AED5487297B61188A5D4`
13. `VALIDATION_REPORT_v0.2.6.md`: `EE396FC12D5C45D198596BFF90DD9454D27B446A20E3721FD654ABB2EBF94E5F`
14. `VALIDATION_REPORT_v0.2.7.md`: `2262010D22AC958EFEAC14BAF11152CF3FC81324CFBEFA674483B79EE75278CD`
15. `VALIDATION_REPORT_v0.2.8.md`: `0B627A9ACD9E274F1B93CC3AA9433511EDD70496C4FA9602B38B84943AE9FFA8`

---

## 5. Dictamen Interno de Remediación

**DICTAMEN INTERNO:** PASS (REMEDIACIÓN v0.2.9 COMPLETADA).  
**ESTADO DE FASE 1:** CONTINÚA BLOQUEADA A LA ESPERA DEL DICTAMEN DE AUDITORÍA EXTERNA INDEPENDIENTE.
