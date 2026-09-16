# Matriz de Remediación Técnica — Release v0.3.15 (Fase 1.1 Correctiva)

Este documento registra la remediación mecánica y semántica de los 5 hallazgos de auditoría identificados en la versión **v0.3.14**, cerrando de forma definitiva todos los vectores de denegación en la resolución de tokens bajo `FORCE ROW LEVEL SECURITY`, la gobernanza de roles con `BYPASSRLS` y la idempotencia del ciclo de vida de la base de datos PostgreSQL 16.

> [!IMPORTANT]
> **REMEDIADO LOCALMENTE — NO DESPLEGAR A PRODUCCIÓN**  
> El servidor productivo y el entorno de Plesk permanecen congelados en **v0.3.11** hasta recibir la revisión y aprobación humana.

---

## Matriz de Remediaciones

| ID | Severidad | Componente / Archivo | Descripción del Hallazgo Auditado | Remediación Implementada y Verificada en v0.3.15 |
|---|---|---|---|---|
| **SEC-11** | **Crítico** | [`db/0002_bootstrap_permissions.sql`](db/0002_bootstrap_permissions.sql) | `0002_bootstrap_permissions.sql` reasignaba la propiedad de todas las funciones de `public` a `app_owner` (`NOBYPASSRLS`), anulando la asignación a `token_resolver` y bloqueando la resolución bajo `FORCE RLS`. | Se excluyeron las 3 funciones resolver (`resolve_session_by_token`, `resolve_invitation_by_token`, `get_user_active_memberships`) del bucle genérico y se reasignó su propiedad explícitamente a `token_resolver` en el post-bootstrap. |
| **SEC-12** | **Alto** | [`db/0000_bootstrap_roles.sql`](db/0000_bootstrap_roles.sql)<br>[`db/0002_bootstrap_permissions.sql`](db/0002_bootstrap_permissions.sql) | `token_resolver` conservaba el permiso `CREATE` en el esquema `public` procedente del grant de pre-bootstrap. | Se revocó `CREATE` sobre `public` a `token_resolver` (`REVOKE CREATE ON SCHEMA public FROM token_resolver;`), otorgándole únicamente `USAGE` sobre `public` y `SELECT` sobre las 4 tablas estrictamente necesarias. |
| **SEC-13** | **Alto** | [`db/0000_bootstrap_roles.sql`](db/0000_bootstrap_roles.sql)<br>[`db/0002_bootstrap_permissions.sql`](db/0002_bootstrap_permissions.sql)<br>[`db/migrations/0004_fase_1_1_token_resolver_fix.sql`](db/migrations/0004_fase_1_1_token_resolver_fix.sql) | La membresía `GRANT token_resolver TO app_owner` permanecía otorgada tras transferir la propiedad de las funciones. | Se agregó `REVOKE token_resolver FROM app_owner;` inmediatamente después de transferir la propiedad de las funciones tanto en las migraciones como en post-bootstrap. |
| **SEC-14** | **Medio** | [`db/migrations/0003_fase_1_1_identity_rbac_down.sql`](db/migrations/0003_fase_1_1_identity_rbac_down.sql) | El script de rollback `0003_..._down.sql` no eliminaba la función `get_user_active_memberships(UUID)`. | Se agregó `DROP FUNCTION IF EXISTS get_user_active_memberships(UUID);` en `0003_fase_1_1_identity_rbac_down.sql`. |
| **SEC-15** | **Medio** | [`db/migrations/0004_fase_1_1_token_resolver_fix.sql`](db/migrations/0004_fase_1_1_token_resolver_fix.sql) | Necesidad de migración forward-only para garantizar compatibilidad sin fallos de checksum si `0003` ya fue aplicada. | Se emitió la migración incremental `0004_fase_1_1_token_resolver_fix.sql` (y `0004_..._down.sql`) preservando el checksum inmutable de `0003`. |

---

## Verificación de Aserciones de Catálogo en PostgreSQL 16 Real

Se incorporaron aserciones automáticas en [`scripts/test-integration-pg16.mjs`](scripts/test-integration-pg16.mjs), ejecutadas dos veces seguidas para comprobar idempotencia tras bootstrap pre, migración y bootstrap post:

1. **Propiedad de Funciones Resolver:**  
   `SELECT pg_catalog.pg_get_userbyid(proowner) FROM pg_proc WHERE proname IN ('resolve_session_by_token', 'resolve_invitation_by_token', 'get_user_active_memberships')`  
   - Resultado: Todas pertenecen a `token_resolver`.
2. **Ausencia de Permiso CREATE:**  
   `SELECT has_schema_privilege('token_resolver', 'public', 'CREATE')`  
   - Resultado: `false`.
3. **Ausencia de Membresía en app_owner:**  
   `SELECT 1 FROM pg_auth_members WHERE roleid = 'token_resolver' AND member = 'app_owner'`  
   - Resultado: 0 filas (membresía revocada exitosamente).
