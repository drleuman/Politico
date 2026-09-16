# Registro de Cambios (CHANGELOG) — Política Canon

Todas las modificaciones notables introducidas en este proyecto serán documentadas en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-09-16

### Añadido y Remediado (Dictamen de Auditoría Externa v0.3.0)
- **Autocontención de Pruebas en Checkout Limpio (C-01):** Configurada la cadena `"test": "npm run build && node validate_v0.3.1.cjs"` en `package.json`, asegurando que `npm test` sea 100% autocontenido en repositorios clonados desde cero (`npm ci && npm test`) sin requerir ejecuciones manuales previas.
- **Separación de Roles de Base de Datos y Bootstrap (C-02):** Desglosado el flujo de base de datos en dos comandos: `scripts/bootstrap-database.mjs` (`npm run bootstrap:prod`) ejecutable por el administrador superusuario (`postgres`) para crear roles (`app_owner`, `app_user`, `audit_worker`, etc.), y `scripts/migrate-production.mjs` (`npm run migrate:prod`) para parches DDL.
- **Bloqueo Exclusivo y Verificación Fail-Closed de Checksums (H-01):** Incorporado `SELECT pg_advisory_lock(87850301);` en el migrador para evitar carreras de ejecución concurrente y verificación de checksums SHA-256 en `schema_migrations` que aborta inmediatamente por `CHECKSUM_MISMATCH` si se altera un archivo SQL previamente aplicado.
- **Autenticación HTTP Nginx Real:** Activadas las directivas `auth_basic "Acceso Restringido — Intranet Política Canon";` y `auth_basic_user_file` en `deploy/plesk/vhost_nginx.conf`.
- **Provisión Automática de Secretos de Sesión:** Añadida la generación automática de `SESSION_SECRET` de 32+ bytes (`openssl rand -hex 32`) en `deploy/scripts/provision.sh`.

---

## [0.3.0] - 2026-09-16

### Añadido y Remediado (Dictamen de Auditoría de Predespliegue Politico-main)
- **Restauración de Línea Base Histórica v0.2.18:** Preservación inmutable de `politica-canon-v0.2.18.zip` e informes asociados al SHA-256 histórico original (`5d7c18e99be808709d28f6028c42d4b823348c35a062dd547ad2bcd3f0fa043b`). Emisión formal del nuevo release `v0.3.0` para el aprovisionamiento y despliegue del monolito Fastify (Fase 1 MVP).
- **Migrador Idempotente en Repositorio (`scripts/migrate-production.mjs`):** Implementado migrador ejecutable Node.js con control de versiones transaccional mediante la tabla `schema_migrations`, aplicando `db/migrations/0001_initial_schema.sql` y `db/bootstrap_roles.sql` con hashing SHA-256 de verificación.
- **Artefactos de Despliegue Versionados (`deploy/`):** Añadidos los archivos versionados `deploy/systemd/politica-canon.service`, `deploy/plesk/vhost_nginx.conf` y `deploy/scripts/provision.sh` para provisión estandarizada en Ubuntu 24.04 / Plesk.
- **Protección de Portada Intranet y Cero Fugas de Infraestructura:** Rediseñada `public/index.html` como un portal de identificación y acceso a la Intranet Privada sin metadatos ni versiones públicas de Node.js, PostgreSQL o Redis.
- **Endurecimiento de Conexiones y Shutdown Controlado:** Reducido el pool de conexiones PostgreSQL a `max: 10` (por debajo del límite del rol `politica-canon_app`), sanitización de logs de Redis sin credenciales en URLs, y hooks `SIGTERM`/`SIGINT` en Fastify para cierre limpio de sockets y conexiones.
- **Pruebas HTTP Reales en Suite (`validate_v0.3.0.cjs`):** Pruebas integradas en `npm test` verificando probes HTTP `/healthz` (200 OK), `/readyz` (503/200 OK) y protección de portada de Intranet.

---

## [0.2.18] - 2026-09-16

### Añadido y Remediado (Dictamen de Auditoría v0.2.17)
- **Control de Inmutabilidad de Decisiones y Transición Habilitada (C-01):** Implementada `prevent_decisions_immutability_violation()` que rechaza `DELETE` y exige `app.allow_decision_update` o `app.allow_protected_transition` para `UPDATE`, verificando que las columnas inmutables de identidad (`id`, `organization_id`, `workspace_id`, `authority_body_id`, `document_id`, `version_id`, `submission_id`, `created_at`) permanezcan inalteradas. Habilitado `PERFORM set_config('app.allow_decision_update', 'true', true);` en las funciones `SECURITY DEFINER` `cast_vote_transactional` y `approve_decision_transactional`.
- **Suite de Pruebas de Integración Ejecutables en PostgreSQL 16 WASM (H-01):** Implementado `validate_v0.2.18.cjs` (`npm test`) integrando `@electric-sql/pglite` (motor PostgreSQL 16 WASM nativo en Node.js), ejecutando la carga del DDL `0001_initial_schema.sql`, bootstrap de roles, verificación de canonicalización JCS numérico/Unicode PL/pgSQL, flujo completo de voto transaccional (1er voto, 2º voto, 3er voto, cambio de voto y finalización) y rollback DDL down.
- **Manifiesto Externo Desacoplado Post-ZIP (H-02):** Generado `MANIFEST_v0.2.18.json` adjunto a `politica-canon-v0.2.18.zip` en el directorio de entrega con comprobación exacta de hash SHA-256 y bytes.

---

## [0.2.17] - 2026-09-16

### Añadido y Remediado (Dictamen de Auditoría v0.2.16)
- **Formateo Numérico Exponencial JCS RFC 8785 en PL/pgSQL (C-01):** Implementada `jcs_format_number(p_num NUMERIC)` en PL/pgSQL que formatea números según la norma ES6 / RFC 8785: notación exponencial sin ceros a la izquierda en exponente ni decimales z-padded para $|n| < 10^{-6}$ o $|n| \ge 10^{21}$ (`1e-7`, `1e+21`), y `TRIM_SCALE` para decimales/enteros (`100`, `0.0015`), garantizando coincidencia byte a byte con JS `worker.ts`.
- **Restricción CHECK de Votos e Inserción Atómica (C-02):** Actualizado el `CHECK` en `decisions` a `approval_votes_count >= 0` e inserción atómica inicial en `cast_vote_transactional`, permitiendo crear la sesión de decisión con 0 votos iniciales sin violar invariantes.
- **Suite de Pruebas de Integración Ejecutables en PostgreSQL 16 (H-01):** Arnés `validate_v0.2.17.cjs` (`npm test`) conectándose a PostgreSQL 16 `politica_canon_db`, ejecutando DDLs, bootstraps de roles, pruebas de canonicalización JCS numéricas/Unicode, pruebas de votación colegiada $N=1,2,3,4$, cambios de voto de `APPROVE` a `REJECT`, y rollback completo con `0001_initial_schema_down.sql`.
- **Manifiesto Externo Desacoplado Post-ZIP (H-02):** Generado `MANIFEST_v0.2.17.json` adjunto a `politica-canon-v0.2.17.zip` con comprobación exacta de hash SHA-256 y bytes.

---

## [0.2.16] - 2026-09-16

### Añadido y Remediado (Dictamen de Auditoría v0.2.15)
- **Canonicalizador JCS RFC 8785 en PostgreSQL 16 sin UTF16BE (C-01):** Implementada la función PL/pgSQL `jcs_utf16_sort_key(p_key TEXT)` para codificar claves a unidades de código UTF-16 BE, permitiendo a `jcs_canonicalize_jsonb` ordenar claves de objeto de forma 100% compatible con RFC 8785 y ejecutable en PostgreSQL 16 sin depender de `convert_to(..., 'UTF16BE')`.
- **Votación Atómica y Quórum Colegiado Estricto (C-02):** `cast_vote_transactional` ahora inserta/actualiza atómicamente el voto del actor autenticado en `decision_votes`. `approve_decision_transactional` / `finalize_decision_transactional` cuentan los votos registrados en `decision_votes` y exige mayoría estricta (`v_approve_votes > v_total_eligible / 2.0`), impidiendo que un único voto apruebe en cuerpos de 2 o más elegibles.
- **Suite de Validación Ejecutable contra PostgreSQL 16 (H-01):** Creado `validate_v0.2.16.cjs` (`npm test`) para ejecutar DDLs, bootstraps de roles, canonicalización JCS, votaciones colegiadas con 2, 3 y 4 elegibles, y reversibilidad DDL down en PostgreSQL 16.
- **Manifiesto Externo Desacoplado Post-ZIP (H-02):** Generado `MANIFEST_v0.2.16.json` adjunto a `politica-canon-v0.2.16.zip` con cotejo exacto de SHA-256 y tamaño.
- **Reconciliación de Inventario Documental (H-03):** Unificadas todas las referencias vigentes a 30 Entidades Conceptuales Mermaid y 30 Tablas Físicas DDL.

---

## [0.2.15] - 2026-09-15

### Añadido y Remediado (Cierre Integral de Auditoría v0.2.9)
- **Recalculación Criptográfica en SQL y Transacción TS (C-01):** `verify_audit_chain` en PL/pgSQL recalcula el hash SHA-256 usando `digest(..., 'sha256')` de `pgcrypto`. En `src/audit/worker.ts`, `verifyAuditChainCrypted` ejecuta `set_config` dentro de una transacción explícita `BEGIN...COMMIT` evitando pérdidas de contexto RLS.
- **Validación de Ámbitos y Prohibición Estricta de Admin (C-02):** `evaluateAuthorizationContract` valida `ra.scopeId === resource.workspaceId` en `PUBLISH`, inspecciona `effectiveRoleAssignments` para la prohibición incondicional de Admin, deniega `AUDITOR` sin asignación persistida y valida `target_authority_body_id` en solicitudes de rol `APPROVER`.
- **Protección Trigger contra Mutaciones de Status (C-03):** Añadido trigger BEFORE UPDATE `trg_protect_document_status` en `documents` que impide alterar `status` directamente fuera de funciones transaccionales de servidor.
- **Revocación Estricta de PUBLIC y Aislamiento Worker (C-04):** Ejecutado `REVOKE ALL ON FUNCTION ... FROM PUBLIC` en todas las funciones elevadas. `get_pending_outbox_tenants()` revocada a `app_user` y restringida al rol `audit_worker`.
- **Ownership Real de Esquema y Objetos (C-05):** Añadidas sentencias `ALTER SCHEMA public OWNER TO app_owner`, `ALTER TABLE ... OWNER TO app_owner` para las 30 tablas y funciones.
- **Validador con Compilación TypeScript Nativa (H-01, H-02):** `scratch/validate_v0.2.15.cjs` ejecuta `npm run typecheck` (`tsc --noEmit`), suite de autorización con pruebas de denegación adversarial, y verificación criptográfica estricta SHA-256 de los 17 informes históricos (`v0.2.1` a `v0.2.9`). Creado `package-lock.json` determinista.
- **Manifiesto Externo y Rollback de Roles (H-03, H-05):** Creados `MANIFEST_v0.2.15.json` y `db/bootstrap_roles_down.sql` para reversión de infraestructura de roles.

---

## [0.2.9] - 2026-09-15
- Release de remediación auditado externamente (NO PASS — Dictamen de Auditoría Externa v0.2.9).

## [0.2.8] - 2026-09-15
- Release de remediación auditado externamente (NO PASS).

## [0.2.7] - 2026-09-15
- Release de remediación parcial auditado (NO PASS).

## [0.2.6] - 2026-09-15
- Release de remediación parcial auditado (NO PASS).

## [0.2.5] - 2026-09-15
- Release de remediación parcial auditado (NO PASS).

## [0.2.4] - 2026-09-15
- Release de remediación parcial auditado (NO PASS).

## [0.2.3] - 2026-09-15
- Release de remediación parcial auditado (NO PASS).

## [0.2.2] - 2026-09-15
- Release de remediación parcial auditado (NO PASS).

## [0.2.1] - 2026-09-15
- Release de remediación parcial auditado (NO PASS).

## [0.2.0] - 2026-09-15
- Línea base de arquitectura y gobernanza ratificada (NO PASS).

## [0.1.0] - 2026-09-15
- Release inicial de la Fase 0.
