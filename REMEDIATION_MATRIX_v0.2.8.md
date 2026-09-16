# Matriz de Remediación Byte-by-Byte de la Auditoría v0.2.7 — Política Canon v0.2.8

**Fecha:** 15 de septiembre de 2026  
**Versión Target:** `politica-canon-v0.2.8`  
**Estado:** `REMEDIADO Y VALIDADO CON CÓDIGO Y ARNÉS EJECUTABLE (PENDIENTE DE AUDITORÍA EXTERNA FINAL)`  
**Auditoría Precedente:** Audit Report v0.2.7 (Dictamen: `NO PASS`)  

---

## 1. Resumen de Estado de Remediación v0.2.8

| Hallazgo Auditado | Categoría | Estado | Solución Aplicada en v0.2.8 | Archivo Modificado / Evidencia |
|---|---|---|---|---|
| **C-01** | Línea Base PostgreSQL / Drizzle | **REMEDIADO** | Entrega de `db/migrations/0001_initial_schema.sql` (DDL de 29 tablas, 25 RLS), `db/bootstrap_roles.sql` (provisioning de roles sin contraseñas versionadas y `GRANT SELECT, INSERT, UPDATE, DELETE TO app_user`), y `docker-compose.audit.yml` (PostgreSQL 16+ / Redis 7+). | [`db/migrations/0001_initial_schema.sql`](db/migrations/0001_initial_schema.sql), [`db/bootstrap_roles.sql`](db/bootstrap_roles.sql), [`docker-compose.audit.yml`](docker-compose.audit.yml) |
| **C-02** | Modelo de Roles y Ámbitos | **REMEDIADO** | Se definió `role_assignments` como la fuente de verdad autoritativa unificada con `scope_type` (`ORGANIZATION`, `WORKSPACE`, `AUTHORITY_BODY`), `scope_id` y vigencia. Restricción DDL en `workspace_memberships` e `invitations` contra asignación directa de roles sensibles. | [`db/migrations/0001_initial_schema.sql`](db/migrations/0001_initial_schema.sql#L240-L260), [`src/auth/authorization.ts`](src/auth/authorization.ts) |
| **C-03** | Endurecimiento Doble Control SQL | **REMEDIADO** | `grant_governance_role_transactional(p_organization_id, p_request_id)` valida coincidencia de tenant, aplica `FOR UPDATE` en solicitud y aprobaciones (orden 1 y 2 explícitos), comprueba 4 identidades, valida membresía organizativa activa en los 4 participantes y `GOVERNANCE_REGISTRY`, e inserta evento en `audit_outbox` en la misma transacción. | [`db/migrations/0001_initial_schema.sql`](db/migrations/0001_initial_schema.sql#L356-L490) |
| **C-04** | Evaluador y Bypasses Temporales | **REMEDIADO** | Evaluador `src/auth/authorization.ts` valida `validFrom <= now` y `validUntil > now`, separa lectura pública anónima de intranet, deniega incondicionalmente al Admin y retorna `DEFER_TO_TRANSACTIONAL_COMMAND` en asignaciones de gobernanza. | [`src/auth/authorization.ts`](src/auth/authorization.ts#L100-L240) |
| **C-05** | Worker Outbox Ejecutable | **REMEDIADO** | Módulo TypeScript `src/audit/worker.ts` implementa outbox con `FOR UPDATE SKIP LOCKED`, savepoints por elemento (`SAVEPOINT item_sp`), reintentos para `FAILED` con `next_attempt_at`, cola de letras muertas y canonicalización JSON JCS RFC 8785. | [`src/audit/worker.ts`](src/audit/worker.ts#L1-L150) |
| **C-06** | Verificador Criptográfico de Cadena | **REMEDIADO** | Módulo `src/audit/worker.ts` y SQL `verify_audit_chain` que recalculan criptográficamente el hash SHA-256 de cada sobre JCS, verificando continuidad y Genesis Hash (64 ceros). | [`src/audit/worker.ts`](src/audit/worker.ts#L151-L200), [`db/migrations/0001_initial_schema.sql`](db/migrations/0001_initial_schema.sql#L491-L525) |
| **C-07** | Invariantes Editoriales en DDL | **REMEDIADO** | Restricción `unique_org_doc_version_number` en `document_versions`, FKs compuestas exactas en `submissions`, `reviews` y `publication_events`, y restricciones `CHECK` condicionales por tipo de evento en publicaciones. | [`db/migrations/0001_initial_schema.sql`](db/migrations/0001_initial_schema.sql#L100-L230) |
| **H-01** | Procedencia Completa Publicaciones | FKs compuestas multi-tenant y restricciones `CHECK` para `PUBLISH`, `WITHDRAW` y `REPLACE` en `publication_events`. | [`db/migrations/0001_initial_schema.sql`](db/migrations/0001_initial_schema.sql#L200-L225) |
| **H-02** | Validador Semántico | `scratch/validate_v0.2.8.cjs` ejecuta pruebas de TS en memoria, verifica hashes SHA-256 de los 11 informes históricos y parsea Mermaid dinámicamente. | [`scratch/validate_v0.2.8.cjs`](scratch/validate_v0.2.8.cjs) |
| **H-03** | Grants y Credenciales de BD | Script `db/bootstrap_roles.sql` otorga DML explícito (`SELECT, INSERT, UPDATE, DELETE`) a `app_user` sin contraseñas versionadas. | [`db/bootstrap_roles.sql`](db/bootstrap_roles.sql) |
| **H-04** | Inventario Canónico Completo | `docs/00_INDICE_CANONICO_DOCUMENTAL.md` lista todos los 28 documentos del repositorio. Conteo unificado a 29 Entidades Conceptuales. | [`docs/00_INDICE_CANONICO_DOCUMENTAL.md`](docs/00_INDICE_CANONICO_DOCUMENTAL.md) |
| **H-05** | PRD y Contratos de Datos | Datasets e indicadores formalizados con desacoplamiento claro de Fases 3 y 4 en el PRD. | [`docs/01_PRD.md`](docs/01_PRD.md) |
| **H-06** | Sandbox Chromium | Comando Chromium detallado en `THREAT_MODEL.md` con flags CLI locales, canal STDIN/STDOUT, timeout 10s y límite 10MB. | [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) |
| **H-07** | Estado de Decisiones y Aceptación | Clasificación explícita de `DEC-2026-007` como propuesta técnica ratificada para evaluación externa en `13_REGISTRO_DECISIONES.md`. | [`docs/13_REGISTRO_DECISIONES.md`](docs/13_REGISTRO_DECISIONES.md) |

---

## 2. Declaración de Cierre de Fase 0

Con la entrega de la línea base ejecutable, migraciones SQL, arnés en contenedor, módulos TypeScript del worker y autorizador, y validación semántica al 100%, la versión **v0.2.8** queda presentada para dictamen de auditoría externa final.
