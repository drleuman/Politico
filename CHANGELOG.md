# Registro de Cambios (CHANGELOG) — Política Canon

Todas las modificaciones notables introducidas en este proyecto serán documentadas en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.16] - 2026-09-16

### Remediado y Endurecido (Fase 1.1 Correctiva — Alineación de Scripts de Despliegue en package.json)
- **Alineación Estricta de Scripts de Despliegue (`package.json`):** Eliminados los aliases obsoletos `db:bootstrap` y `db:migrate` (que provocaban `MODULE_NOT_FOUND`) y sustituidos por la convención canónica documentada en `DEPLOYMENT_REPORT.md`: `bootstrap:pre`, `migrate:prod` y `bootstrap:post`.
- **Verificación Automática de Existencia de Scripts (`validate_v0.3.16.cjs`):** Añadida aserción explícita en la validación estática que verifica la presencia en `package.json` y resolubilidad física en disco de los 3 scripts de despliegue (`bootstrap-pre.mjs`, `migrate-production.mjs`, `bootstrap-post.mjs`).
- **Sincronización del Banner del Runner de Integración (`scripts/test-integration-pg16.mjs`):** Sincronizadas todas las marcas e impresiones del runner a `v0.3.16`.

---

## [0.3.15] - 2026-09-16

### Remediado y Endurecido (Fase 1.1 Correctiva — Corrección de Propiedad de Funciones Resolver)
- **Corrección de Propiedad de Funciones Resolver (`db/0002_bootstrap_permissions.sql`, `db/migrations/0004_fase_1_1_token_resolver_fix.sql`):** Excluidas las 3 funciones resolver (`resolve_session_by_token`, `resolve_invitation_by_token`, `get_user_active_memberships`) del bucle genérico que asignaba la propiedad de funciones a `app_owner` en post-bootstrap. Asignada explícitamente la propiedad de las 3 funciones a `token_resolver` (`BYPASSRLS`).
- **Desacoplamiento Estricto de Permisos y Membresías (`db/0000_bootstrap_roles.sql`, `db/0002_bootstrap_permissions.sql`):** Revocado el permiso `CREATE` en el esquema `public` para `token_resolver`, otorgándole únicamente `USAGE` sobre `public` y `SELECT` sobre las 4 tablas estrictamente necesarias (`user_sessions`, `invitations`, `organization_memberships`, `users`). Revocada la membresía temporal de `app_owner` en `token_resolver` (`REVOKE token_resolver FROM app_owner;`).
- **Aserción de Catálogo PostgreSQL 16 (`scripts/test-integration-pg16.mjs`):** Verificación autoritativa de que la propiedad de las 3 funciones pertenezca a `token_resolver`, que `token_resolver` no tenga `CREATE` en `public`, y que `app_owner` no sea miembro de `token_resolver` tras las tres fases del bootstrap/migración.
- **Rollback Completo y Migración Forward-Only (`db/migrations/0003_fase_1_1_identity_rbac_down.sql`, `db/migrations/0004_fase_1_1_token_resolver_fix.sql`):** Agregado `DROP FUNCTION IF EXISTS get_user_active_memberships(UUID);` en el rollback de `0003` y emitida la migración `0004` para compatibilidad forward-only.

---

## [0.3.14] - 2026-09-16

### Remediado y Endurecido (Fase 1.1 Correctiva — Resolutores FORCE RLS y Controles MFA Estrictos)
- **Rol Resolutor por Hash con BYPASSRLS Acotado (`db/0000_bootstrap_roles.sql`, `db/migrations/0003_fase_1_1_identity_rbac.sql`):** Creado el rol `token_resolver` con `BYPASSRLS` dedicado únicamente a ostentar la propiedad de las funciones `SECURITY DEFINER` de resolución por hash (`resolve_session_by_token`, `resolve_invitation_by_token`, `get_user_active_memberships`). Esto permite resolver tokens por su SHA-256 único bajo `FORCE ROW LEVEL SECURITY` antes de fijar el GUC de organización, manteniendo denegación estricta en el resto de consultas.
- **MFA Obligatorio y Reciente para Gestión de Invitaciones (`src/auth/routes.ts`):** `POST`, `GET` y `DELETE /api/v1/invitations` verifican estrictamente que `user.mfaEnabled === true` **y** `mfaAgeSeconds <= 900` (frescura <= 15 min / 900s). Rechazo con `403 Forbidden` (`MFA_REQUIRED`) si no está habilitado o está vencido.
- **Suite Adversarial Completa en Integración Real (`scripts/test-integration-pg16.mjs`):** Aserciones del catálogo PostgreSQL 16 para `token_resolver` `BYPASSRLS`, resolución por hash bajo `FORCE RLS`, rechazo de Admin sin MFA configurado, rechazo de Admin con MFA vencido (>15 min) y éxito únicamente con MFA habilitado y verificado (<15 min).

---

## [0.3.13] - 2026-09-16

### Remediado y Endurecido (Fase 1.1 Correctiva — Endurecimiento de Seguridad)
- **RLS Estricto sin Fallback (`db/migrations/0003_fase_1_1_identity_rbac.sql`):** Eliminado `OR GUC IS NULL` de todas las políticas RLS en `user_sessions` e `invitations`. Creadas funciones `SECURITY DEFINER` `resolve_session_by_token` y `resolve_invitation_by_token` (propiedad de `app_owner`), con permisos `EXECUTE` concedidos explícitamente a `app_user` y `politica_canon_app`. Al resolver sesión se fija `app.current_organization_id = organization_id` en la conexión.
- **RBAC/ABAC y Control MFA en Invitaciones (`src/auth/routes.ts`, `src/auth/invitations.ts`):** `POST /api/v1/invitations` verifica que la sesión del llamante posea rol `ADMIN` o `COORDINATOR` en la organización objetivo, posea sesión MFA fresca (<15 minutos), y restringe explícitamente la creación de invitaciones para roles de gobernanza (`APPROVER`, `PUBLISHER`, `AUDITOR`).
- **Verificación Estricta de Membresía en Login (`src/auth/routes.ts`):** `POST /api/v1/auth/login` valida la existencia de membresía activa en `organization_memberships` antes de generar la sesión (`403 Forbidden` en caso contrario).
- **Protección de Tokens y Transmisión Exclusiva `HttpOnly` (`src/auth/routes.ts`):** Eliminado el campo `token` de las respuestas JSON de login/mfa (el token se transmite únicamente en la cookie `politica_canon_session` / `sid`). Eliminado `resetToken` de la respuesta JSON de `forgot-password`.
- **Validación Fail-Closed de Secreto de Sesión/MFA (`src/config/env.ts`):** `SESSION_SECRET` exige mínimo 32 caracteres y rechaza valores por defecto/placeholders en el arranque.
- **Verificación Anti-CSRF Obligatoria (`src/auth/routes.ts`):** Validación obligatoria de la cabecera `X-CSRF-Token` contra cookie CSRF en todos los endpoints mutables (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Rate Limit Fail-Closed en Redis (`src/auth/routes.ts`):** Captura de fallos de Redis respondiendo `503 Service Unavailable` (`RATE_LIMIT_SERVICE_UNAVAILABLE`).
- **Filtro de Expiración en Contexto de Autorización (`src/auth/roles.ts`):** Filtrado de asignaciones y membresías caducadas (`valid_from <= NOW()` y `valid_until > NOW()`).
- **Enlaces Portables en Documentación Markdown (`validate_v0.3.13.cjs`):** Convertidos todos los enlaces en informes Markdown a rutas relativas portables. Validador `validate_v0.3.13.cjs` verifica ausencia de esquemas `file:///` locales.

---

## [0.3.12] - 2026-09-16

### Añadido (Fase 1.1 — Identidad, Invitaciones, Usuarios, Sesiones y RBAC/ABAC)
- **Invitaciones Privadas de Un Solo Uso (`src/auth/invitations.ts`):** Implementada creación (`POST /api/v1/invitations`), listado (`GET /api/v1/invitations`), revocación (`DELETE /api/v1/invitations/:id`) y consumo de invitaciones (`POST /api/v1/invitations/accept`). Generación de tokens de alta entropía de 256 bits, almacenamiento exclusivo de su hash SHA-256 (`token_hash`) y vinculación estricta a organización, workspace opcional, rol inicial y emisor auditado.
- **Gestión de Usuarios y Credenciales Argon2id (`src/auth/crypto.ts`):** Alta de usuarios condicionada al consumo de invitaciones válidas. Hashing de contraseñas con Argon2id (`m=65536, t=3, p=4`), validación de complejidad mínima y flujo seguro de restablecimiento de contraseña mediante tokens de un solo uso con expiración.
- **Sesiones Persistidas y Rotación en PostgreSQL (`src/auth/session.ts`):** Tabla `user_sessions` en PostgreSQL como fuente autoritativa de verdad. Rotación del token de sesión en login y elevación de privilegios. Expiración inactiva (30m), expiración absoluta (24h), límite de 5 sesiones activas por usuario y cierre de sesión individual (`/logout`) y masivo (`/logout-all`). Cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- **TOTP MFA y Regla de Frescura de Gobernanza (`src/auth/mfa.ts`):** Enrolamiento TOTP (RFC 6238), cifrado AES-256-GCM del secreto en reposo (`users.mfa_secret_encrypted`), 10 códigos de respaldo de un solo uso (`mfa_backup_codes`) y verificación step-up (`POST /api/v1/auth/mfa/verify`) para actualizar `mfa_verified_at` exigida para acciones sensibles (frescura <= 15 min / 900s).
- **RBAC/ABAC Persistido y Servidor-Centric (`src/auth/roles.ts`):** Resolución de contexto de autorización desde `role_assignments`, `organization_memberships`, `workspace_memberships` y `authority_memberships`. Evaluación centralizada en `evaluateAuthorizationContract()`.
- **Eventos de Seguridad en Audit Outbox (`src/audit/events.ts`):** Registro atómico y sanitizado de eventos de seguridad (`INVITATION_*`, `USER_REGISTERED`, `LOGIN_*`, `LOGOUT_*`, `PASSWORD_RESET_*`, `MFA_*`, `ROLE_ASSIGNED`) en `audit_outbox`.
- **Migración DDL Incremental (`db/migrations/0003_fase_1_1_identity_rbac.sql`):** Modificaciones DDL executadas por `app_owner` para hacer `workspace_id` opcional en invitaciones, añadir campos MFA y bloqueo en `users`, y actualizar `0002_bootstrap_permissions.sql` con RLS e imposición de privilegios mínimos para `politica_canon_app`.

---

## [0.3.11] - 2026-09-16

### Añadido y Remediado (Dictamen de Auditoría v0.3.10 — Bloqueadores B-01 y B-02)
- **Modelo de Permisos Restringido por Pertenencia a Grupo (B-02):** Actualizado `deploy/scripts/provision.sh` y `DEPLOYMENT_REPORT.md` para cerrar los permisos del árbol de aplicación de `0755` a `0750` para directorios y `0640` para archivos. Se incorpora la pertenencia idempotente del usuario Unix `postgres` al grupo `politica-canon` (`usermod -aG politica-canon postgres`), garantizando acceso exclusivo para el runtime y las ejecuciones de bootstrap sin abrir lectura a usuarios del sistema no autorizados.
- **Generación UTF-8 Estricta sin BOM en Manifiesto JSON:** Ajustado `scratch/create_zip_v0.3.11.ps1` usando `System.Text.UTF8Encoding($false)` para producir `MANIFEST_v0.3.11.json` sin marcas BOM en la codificación UTF-8.
- **Actualización de Mensajes de Logs de Versión:** Corregido el migrador DDL `scripts/migrate-production.mjs` (anteriormente anunciaba `v0.3.4`) y el runner de integración real `scripts/test-integration-pg16.mjs` (anteriormente anunciaba `v0.3.9`) sincronizando la versión activa `v0.3.11`.
- **Alineación de Metadatos:** Sincronizada la versión `0.3.11` en `package.json`, `deploy/systemd/politica-canon.service`, `public/index.html`, `src/server.ts`, `deploy/scripts/provision.sh`, `deploy/plesk/vhost_nginx.conf`, `DEPLOYMENT_REPORT.md`, matrices de remediación y validación.

---

## [0.3.10] - 2026-09-16

### Añadido y Remediado (Ajustes de Despliegue Real Plesk / Ubuntu 24.04)
- **Compatibilidad de PostgreSQL en Sonda de Salud (`src/db/client.ts`):** Actualizada la consulta en `checkDatabaseHealth()` para consultar `pg_roles` (en lugar de `pg_user`) con nombres de columna de catálogo PostgreSQL 16 `rolsuper`, `rolbypassrls`, `rolcreatedb`, `rolcreaterole`, `rolreplication` y `rolname = current_user`.
- **Concesión de Permiso de Conexión a Base de Datos (`db/0002_bootstrap_permissions.sql`):** Añadido `GRANT CONNECT ON DATABASE politica_canon TO politica_canon_app;` en el script post-bootstrap manteniendo el rol runtime `NOSUPERUSER` y `NOBYPASSRLS`.
- **Extensión `pgcrypto` Pre-Bootstrap (`db/0000_bootstrap_roles.sql`):** Añadido `CREATE EXTENSION IF NOT EXISTS pgcrypto;` en el pre-bootstrap ejecutado como superusuario `postgres` previo a `SET ROLE app_owner`.
- **Script de Provisión Idempotente (`deploy/scripts/provision.sh`):** Modificado para extraer la URL de base de datos desde `POLITICA_CANON_DATABASE_URL`, `DATABASE_URL` o `POLITICA_CANON_DB_PASS`, crear la carpeta de caché npm `/opt/politica-canon/.npm-cache`, aplicar el modelo de permisos atravesables de directorio (`0755`) y escribir `/etc/politica-canon/runtime.env` (modo `0640` `root:politica-canon`) sin imprimir secretos.
- **Configuración Proxy Dual Nginx + Apache en Plesk (`deploy/plesk/vhost_nginx.conf` y `DEPLOYMENT_REPORT.md`):** Eliminado el bloque `location /` duplicado en Nginx para evitar el error `duplicate location "/"` de Plesk. Documentadas las directivas Apache `ProxyPass`/`ProxyPassReverse` con `RequestHeader set X-Forwarded-Proto`, permisos `0640` `root:nginx` para `htpasswd_politica_canon`, y comprobación HTTP 401/200.
- **Patrón Seguro de Copia de Seguridad Pre-Migración (`DEPLOYMENT_REPORT.md`):** Actualizado el comando de backup a `sudo -u postgres pg_dump --format=custom politica_canon > "$backup"` con `chmod 0600` evitando problemas de permisos en `/root/`.
- **Alineación de Versión y Calidad:** Actualizados metadatos del servicio systemd, landing page HTML y logs de servidor Fastify a `v0.3.10`.

---

## [0.3.9] - 2026-09-16

### Añadido y Remediado (Dictamen Independiente de Predespliegue v0.3.8 / PASS Formal v0.3.9)
- **Inclusión Directa de Integración Real en `npm test` (C-01):** Configurado `package.json` para ejecutar directamente `node scripts/test-integration-pg16.mjs` dentro de `npm test`. La suite canónica falla cerrado inmediatamente (`REAL_PG16_AND_REDIS_REQUIRED`) si Docker Engine o los contenedores reales no están disponibles.
- **Evidencia Ejecutada contra PostgreSQL 16 y Redis 7 Reales (C-02):** Certificada la salida completa sobre contenedores PostgreSQL 16 (puerto 15432) y Redis 7 (puerto 16379) reales en Docker Compose, ejecutando 2 rondas de las 3 fases de producción (`bootstrap:pre`, asignación de contraseña `POLITICA_CANON_APP_TEST_PASSWORD`, `migrate:prod`, `bootstrap:post`), aserciones de catálogo nativas (`datdba = app_owner`), denegación DML a `app_user` y probe Fastify `GET /readyz` HTTP 200 `{"status":"ready","database":"connected","redis":"connected"}` sin monkey-patching ni sustitución de clases.
- **Garantía Incondicional del Bloque `finally` (C-03):** Reemplazadas todas las llamadas a `process.exit(1)` internas en `scripts/test-integration-pg16.mjs` por propagación de excepciones mediante `throw new Error(...)`. Se asegura que la llamada `docker compose down -v` en `finally` se ejecute incondicionalmente destruyendo contenedores, volúmenes y liberando puertos antes de la captura final de excepciones.
- **PASS FORMAL DE PREDESPLIEGUE (Cierre de Pre-despliegue):** Obtención del dictamen independiente favorable de predespliegue para el paquete `politica-canon-v0.3.9.zip` (SHA-256 `5d0e47c7d6cb15ad44a90a5a51cc02aa2cffe94111828a5c25389af4b071d414`), autorizando el despliegue en el servidor Plesk.

---

## [0.3.4] - 2026-09-16

### Añadido y Remediado (Dictamen Independiente de Predespliegue v0.3.3)
- **Migración DDL Administrativa con SET ROLE Obligatorio y Fail-Closed (C-01):** Configurado `scripts/migrate-production.mjs` para autenticar vía socket Unix local / `MIGRATION_DATABASE_URL` administrativa, ejecutar obligatoriamente `SET ROLE app_owner;` y comprobar `current_user = 'app_owner'`. Se aborta inmediatamente (`process.exit(1)`) si `SET ROLE` o la aserción fallan, evitando que `politica_canon_app` cree objetos DDL.
- **Restitución del Aislamiento del Despachador de Auditoría (C-02):** Restituido el atributo `BYPASSRLS` en `audit_dispatcher` dentro de `db/0000_bootstrap_roles.sql`. Asignada la propiedad de `get_pending_outbox_tenants()` explícitamente a `audit_dispatcher` y concedida su ejecución de forma **exclusiva** a `audit_worker` (revocado de `PUBLIC`, `app_user` y `politica_canon_app`).
- **Transferencia de Propiedad por Firma Exacta (C-03):** Modificada la Fase 3 en `db/0002_bootstrap_permissions.sql` utilizando `pg_proc` y `pg_get_function_identity_arguments` para transferir firmas de funciones exactas a `app_owner`, preservando intencionalmente `get_pending_outbox_tenants()` bajo `audit_dispatcher`.
- **Privilegios por Defecto para Futuras Funciones (H-01):** Incorporado `ALTER DEFAULT PRIVILEGES FOR ROLE app_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;` y `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;` en `db/0002_bootstrap_permissions.sql`.
- **Matriz DML de Mínimos Privilegios en Tablas de Gobernanza (H-02):** Denegadas escrituras directas (`INSERT, UPDATE, DELETE`) en `organizations`, `workspaces`, `authority_bodies`, `authority_memberships`, `organization_memberships`, `users`, `role_assignments`, `decisions`, `decision_votes`, `publications`, `publication_events`, `audit_events` y `audit_outbox` para `app_user` y `politica_canon_app`.
- **Inspección de Salud Aumentada en Runtime (H-03):** Ampliada la función `checkDatabaseHealth()` en `src/db/client.ts` para asertar `db_owner === 'app_owner'`, `schema_owner === 'app_owner'` y ausencia de privilegios `CREATE` en el rol runtime.
- **Alineación de Metadatos y Pruebas HTTP (H-04, H-05):** Actualizados artefactos de despliegue a `v0.3.4` y arnés de pruebas integradas Fastify en `validate_v0.3.4.cjs` (`npm test`).

---

## [0.3.3] - 2026-09-16

### Añadido y Remediado (Dictamen Independiente de Predespliegue v0.3.2)
- **Corrección de URI de Socket Unix y Selección de DB (C-01):** Corregida la sintaxis URI de sockets Unix (`postgresql:///politica_canon?host=/var/run/postgresql`) en `scripts/bootstrap-pre.mjs` y `scripts/bootstrap-post.mjs`, garantizando que `dbname` no sea ignorado por el driver de PostgreSQL. Añadida verificación explícita de `current_database() = 'politica_canon'` y `usesuper = true`.
- **Aislamiento Estricto del Rol de Migración DDL (C-02):** Actualizado `scripts/migrate-production.mjs` para autenticar vía `MIGRATION_DATABASE_URL` y ejecutar inmediatamente `SET ROLE app_owner;` tras la conexión. Se asegura que el usuario runtime `politica_canon_app` no sea propietario de ningún objeto DDL.
- **Transferencia de Propiedad de Base de Datos y Esquema (C-03):** Añadidas sentencias explícitas `ALTER DATABASE politica_canon OWNER TO app_owner;` y `ALTER SCHEMA public OWNER TO app_owner;` en `db/0002_bootstrap_permissions.sql`. Revocado el privilegio `CREATE` en `public` a `PUBLIC` y a `politica_canon_app`.
- **Matriz Explícita de Mínimos Privilegios DML (C-04):** Eliminada la concesión indiscriminada `GRANT ALL ON ALL TABLES`. Implementadas revocaciones explícitas de `INSERT, UPDATE, DELETE` para las tablas sensibles de gobernanza y auditoría (`decision_votes`, `decisions`, `role_assignments`, `publications`, `publication_events`, `audit_events`, `audit_outbox`) tanto para `app_user` como para `politica_canon_app`.
- **Revocación Global de EXECUTE a PUBLIC (C-05):** Añadido `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;` en `db/0002_bootstrap_permissions.sql`, concediendo ejecución únicamente por firma exacta a los roles autorizados (`app_user`, `politica_canon_app`).
- **Verificación Completa de Salud del Runtime (H-01 a H-05):** Extendida la función `checkDatabaseHealth()` en `src/db/client.ts` para verificar que el rol runtime no posea `is_superuser`, `bypass_rls`, `createdb`, `createrole`, `replication` ni propiedad de base o esquema. Robustecido `deploy/scripts/provision.sh` en modo fail-closed y actualizada la descripción del servicio systemd a `v0.3.3`.

---

## [0.3.2] - 2026-09-16

### Añadido y Remediado (Dictamen de Auditoría Externa v0.3.1)
- **Secuenciación de Base de Datos en 3 Fases Explicitas (C-01):** Dividida la inicialización de base de datos en 3 fases independientes e idempotentes:
  1. Fase 1 Pre-Bootstrap (`db/0000_bootstrap_roles.sql` / `npm run bootstrap:pre`): Creación exclusiva de roles y grupos ejecutada como superusuario `postgres`.
  2. Fase 2 Migración DDL (`db/migrations/0001_initial_schema.sql` / `npm run migrate:prod`): Creación de tablas, vistas e índices por el rol de migración/propietario con `pg_advisory_lock`.
  3. Fase 3 Post-Bootstrap (`db/0002_bootstrap_permissions.sql` / `npm run bootstrap:post`): Asignación de propiedad a `app_owner`, `GRANT`/`REVOKE` a `app_user` e imposición de `ENABLE ROW LEVEL SECURITY`.
- **Alineación del Rol Runtime `politica_canon_app` y Aserción de Seguridad (C-02):** Concedida la pertenencia de `politica_canon_app` a `app_user` con `NOSUPERUSER` y `NOBYPASSRLS`. Añadida aserción de arranque en `src/db/client.ts` que rechaza la ejecución si el usuario conectado es superusuario o tiene `rolbypassrls = true`.
- **Soporte de Autenticación Peer vía Socket Unix Local (H-01):** Configurada la conexión por defecto vía socket Unix local (`postgresql:///?host=/var/run/postgresql`) para ejecución como usuario Unix `postgres` con comprobación de privilegios de superusuario (`usesuper = true`).
- **Derivación Segura de Secretos en Provisión (H-02):** Actualizado `deploy/scripts/provision.sh` para derivar la contraseña de base de datos desde `/root/politica-canon/runtime.env` si existe.
- **Limpieza de Portada Web (H-03):** Eliminado el formulario HTML simulado de `public/index.html`, delegando el control de acceso a la directiva `auth_basic` Nginx.
- **Actualización de Metadatos del Servicio (H-04):** Actualizada la descripción de `deploy/systemd/politica-canon.service` a `v0.3.2`.

---

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
