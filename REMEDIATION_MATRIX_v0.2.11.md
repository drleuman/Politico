# Matriz de Remediación Integración y Gobernanza — v0.2.11

**Fecha de emisión:** 15 de septiembre de 2026  
**Línea Base Target:** `politica-canon-v0.2.11`  
**Estado:** REMEDIADO Y VALIDADO (PENDIENTE DE AUDITORÍA EXTERNA FINAL)

---

## 1. Resumen Ejecutivo de la Remediación v0.2.11

La versión **v0.2.11** subsana de forma técnica, rigurosa y verificable todos los hallazgos críticos (C-01 a C-05) y hallazgos altos (H-01 a H-05) identificados en la auditoría externa de `v0.2.10`. Se entrega una línea base ejecutable en PostgreSQL 16+ con compilación TypeScript estricta, autorizador robusto, worker RLS funcional con despachador especializado, validación física/semántica real y manifiesto externo desacoplado del archivo ZIP.

---

## 2. Matriz de Cierre de Hallazgos Críticos

| ID | Clasificación | Hallazgo de Auditoría v0.2.10 | Estado | Solución Técnica Implementada en v0.2.11 |
|---|---|---|---|---|
| **C-01** | CRÍTICO | El verificador SQL sólo rechazaba un hash si era `repeat('a', 64)`, permitiendo validar cualquier otro hash falsificado. | **REMEDIADO** | Eliminada totalmente la excepción `repeat('a', 64)` en `verify_audit_chain`. La función en PL/pgSQL ahora rechaza incondicionalmente cualquier `v_rec.event_hash <> v_computed_hash`. |
| **C-02** | CRÍTICO | SQL y TypeScript no compartían la misma fórmula canónica de hashing SHA-256. | **REMEDIADO** | Unificada la especificación del sobre RFC 8785 JSON canónico en PL/pgSQL (`pgcrypto`) y TypeScript (`worker.ts`). Los objetos serializan exactamente los mismos campos ordenados lexicográficamente (`actorId`, `eventId`, `eventType`, `organizationId`, `payload`, `previousEventHash`, `schemaVersion`, `sequenceNumber`, `timestampIso`). |
| **C-03** | CRÍTICO | El worker dejó de descubrir tenants por FORCE RLS en `audit_outbox` al ser `get_pending_outbox_tenants()` propiedad de `app_owner` (sin BYPASSRLS). | **REMEDIADO** | Creado el rol especializado NOLOGIN `audit_dispatcher` asignado como propietario (`SECURITY DEFINER`) de `get_pending_outbox_tenants()` con privilegio `BYPASSRLS` y permisos SELECT mínimos sobre `audit_outbox`. Los tenants se descubren correctamente sin alterar FORCE RLS para roles de aplicación. |
| **C-04** | CRÍTICO | El verificador SQL validaba cadenas no accesibles (sin RLS/GUC) como vacías devolviendo `is_valid=true, checked_count=0`. | **REMEDIADO** | `verify_audit_chain` comprueba explícitamente si existen eventos para la organización activa. Si no existen filas accesibles o la GUC está vacía, devuelve estado explícito `NO_ACCESSIBLE_EVENTS_FOR_TENANT` e `is_valid=false`. |
| **C-05** | CRÍTICO | Bypasses de ámbito (Publisher en org distinta, Auditor sin asignación persistida, Approver sin `target_authority_body_id`). | **REMEDIADO** | `evaluateAuthorizationContract` exige `scopeId === resource.workspaceId` (o `organizationId`) para `PUBLISH`, exige asignación de rol activa en `role_assignments` para `AUDITOR`, y restringe `APPROVER` al `target_authority_body_id` de la decisión. |

---

## 3. Matriz de Cierre de Hallazgos Altos

| ID | Clasificación | Hallazgo de Auditoría v0.2.10 | Estado | Solución Técnica Implementada en v0.2.11 |
|---|---|---|---|---|
| **H-01** | ALTO | El trigger bloqueaba transiciones de estado documental, pero no existían comandos transaccionales para realizarlas. | **REMEDIADO** | Creadas las funciones SQL transaccionales protegidas `submit_document_draft_transactional`, `freeze_document_submission_transactional`, `approve_decision_transactional` y `publish_document_transactional` que establecen `app.allow_protected_transition=true` de forma segura dentro del bloque de ejecución. |
| **H-02** | ALTO | Invariantes de revisión y decisión incompletas (sin FKs compuestas ni registro individual de votos). | **REMEDIADO** | Incorporada la tabla `decision_votes` con claves foráneas compuestas de tenant/workspace, control de unicidad de votantes y derivación estricta de quórum de aprobación. Añadidas FKs compuestas `(organization_id, workspace_id, submission_id, review_cycle)` en `reviews` y `decisions`. |
| **H-03** | ALTO | El rollback de roles (`bootstrap_roles_down.sql`) fallaba porque `app_owner` poseía objetos y el esquema public. | **REMEDIADO** | `bootstrap_roles_down.sql` ejecuta `ALTER SCHEMA public OWNER TO postgres; REASSIGN OWNED BY ... TO postgres; DROP OWNED BY ...; DROP ROLE ...` garantizando la reversión limpia y determinista desde cualquier estado. |
| **H-04** | ALTO | El validador producía falsos positivos al no ejecutar DDL, TypeScript ni pruebas adversariales. | **REMEDIADO** | Creado `scratch/validate_v0.2.11.cjs` que ejecuta compilación TypeScript (`tsc --noEmit`), verificación DDL SQL, pruebas unitarias de autorización con ataques adversariales, vectores criptográficos SHA-256 de outbox y hashing byte por byte de todos los informes históricos. |
| **H-05** | ALTO | El manifiesto estaba dentro del ZIP y contenía hashes desalineados con el paquete entregado. | **REMEDIADO** | El manifiesto `MANIFEST_v0.2.11.json` se emite como un archivo externo desacoplado ubicado en la raíz del entregable junto a `politica-canon-v0.2.11.zip`, conteniendo los metadatos y SHA-256 calculados tras el cierre del ZIP. |

---

## 4. Verificación de Integridad Histórica Preservada

Se confirma mediante verificación autómata SHA-256 que todos los informes previos de remediación y validación se conservan **100% inmutables e idénticos byte por byte**:

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
11. `VALIDATION_REPORT.md`
12. `VALIDATION_REPORT_v0.2.3.md`
13. `VALIDATION_REPORT_v0.2.4.md`
14. `VALIDATION_REPORT_v0.2.5.md`
15. `VALIDATION_REPORT_v0.2.6.md`
16. `VALIDATION_REPORT_v0.2.7.md`
17. `VALIDATION_REPORT_v0.2.8.md`
18. `VALIDATION_REPORT_v0.2.9.md`
19. `VALIDATION_REPORT_v0.2.10.md`

---

## 5. Dictamen Interno de Remediación

**DICTAMEN INTERNO:** PASS (REMEDIACIÓN v0.2.11 COMPLETADA).  
**ESTADO DE FASE 1:** CONTINÚA BLOQUEADA A LA ESPERA DEL DICTAMEN DE AUDITORÍA EXTERNA INDEPENDIENTE.
