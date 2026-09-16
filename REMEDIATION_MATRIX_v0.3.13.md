# Matriz de Remediación Técnica y Auditoría — Política Canon v0.3.13

**Fecha:** 16 de septiembre de 2026  
**Release:** `v0.3.13` (Fase 1.1 Correctiva — Identidad, Invitaciones, Sesiones, RBAC/ABAC y Endurecimiento de Seguridad)  
**Estado:** `REMEDIADO — LISTO PARA REVISIÓN (NO DESPLEGAR A PRODUCCIÓN — SERVIDOR PERMANECE EN v0.3.11)`

---

## 1. Resumen de Hallazgos de Auditoría y Remediación Técnica

| ID | Severidad | Hallazgo Original Auditoría v0.3.12 | Estado v0.3.13 | Componente / Archivo Afectado | Solución Técnica Aplicada |
|---|---|---|---|---|---|
| **SEC-01** | Crítico | RLS de `user_sessions` e `invitations` permite leer filas de cualquier organización cuando falta `app.current_organization_id` (`... OR GUC IS NULL`). | **Remediado** | [`db/migrations/0003_fase_1_1_identity_rbac.sql`](db/migrations/0003_fase_1_1_identity_rbac.sql), [`src/auth/session.ts`](src/auth/session.ts), [`src/auth/invitations.ts`](src/auth/invitations.ts) | Removido `OR GUC IS NULL` de todas las políticas RLS. Creadas funciones `SECURITY DEFINER` `resolve_session_by_token` y `resolve_invitation_by_token` (de `app_owner`). Al resolver sesión se fija `app.current_organization_id` en la conexión. |
| **SEC-02** | Crítico | Cualquier usuario autenticado puede crear/listar/revocar invitaciones sin RBAC/ABAC ni MFA, pudiendo solicitar roles privilegiados. | **Remediado** | [`src/auth/routes.ts`](src/auth/routes.ts), [`src/auth/invitations.ts`](src/auth/invitations.ts) | Verificación RBAC en `POST /api/v1/invitations` (exige `ADMIN` o `COORDINATOR`), exige sesión MFA fresca (<15 min) y bloquea la creación directa de roles de gobernanza (`APPROVER`, `PUBLISHER`, `AUDITOR`). |
| **SEC-03** | Crítico | `POST /auth/login` acepta `organizationId` del cliente sin comprobar membresía activa del usuario en esa organización. | **Remediado** | [`src/auth/routes.ts`](src/auth/routes.ts) | Comprobación previa en `organization_memberships` (`is_active = TRUE`). Si no existe membresía activa, responde `403 Forbidden` (`ORGANIZATION_MEMBERSHIP_REQUIRED`). |
| **SEC-04** | Crítico | Respuesta de login devuelve `token: rawToken` (anula `HttpOnly`). `forgot-password` expone el token de recuperación. | **Remediado** | [`src/auth/routes.ts`](src/auth/routes.ts) | Removido `token` de respuestas JSON de login/mfa. El token sólo viaja en cookie `HttpOnly`, `SameSite=Strict`, `Secure`. En `forgot-password`, se removió `resetToken` y responde genéricamente. |
| **SEC-05** | Alto | Secreto MFA/Sesión tiene fallback hardcoded `default_master_key...`. Debe fallar cerrado si falta clave dedicada. | **Remediado** | [`src/config/env.ts`](src/config/env.ts) | Validación estricta en el arranque: `SESSION_SECRET` exige mínimo 32 caracteres y rechaza valores por defecto/placeholders. En caso contrario, el servidor se detiene (fail closed). |
| **SEC-06** | Alto | CSRF token generado no se valida en endpoints mutables. | **Remediado** | [`src/auth/routes.ts`](src/auth/routes.ts) | Validación obligatoria de encabezado `X-CSRF-Token` contra cookie `politica_canon_csrf` en todos los métodos mutables (`POST`, `PUT`, `PATCH`, `DELETE`). |
| **SEC-07** | Alto | Si Redis falla, el rate limit devuelve `true` y permite intentos ilimitados. | **Remediado** | [`src/auth/routes.ts`](src/auth/routes.ts) | Interceptor de rate limit captura fallos de Redis y responde inmediatamente `503 Service Unavailable` (`RATE_LIMIT_SERVICE_UNAVAILABLE`), garantizando comportamiento fail closed. |
| **SEC-08** | Alto | Constructor de contexto de roles no filtra asignaciones/membresías vencidas antes de consolidar roles. | **Remediado** | [`src/auth/roles.ts`](src/auth/roles.ts) | Consultas SQL de membresías y roles filtran explícitamente `(valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW()))`. |
| **DOC-01** | Menor | Validador `validate_v0.3.12.cjs` falló por 13 enlaces rotos con rutas absolutas `file:///f:/...`. | **Remediado** | [`VALIDATION_REPORT_v0.3.12.md`](VALIDATION_REPORT_v0.3.12.md), [`validate_v0.3.13.cjs`](validate_v0.3.13.cjs) | Convertidos todos los enlaces de documentación a rutas relativas portables. `validate_v0.3.13.cjs` incluye test que rechaza esquemas `file:///` locales. |

---

## 2. Verificación y Evidencia Adversarial

1. **Docker Compose & PG16 + Redis 7:** El suite `scripts/test-integration-pg16.mjs` ejecuta 2 rondas de migración y bootstrap en PostgreSQL 16 y Redis 7 reales.
2. **Adversarial Security Suite:** Se incluyeron aserciones automáticas para:
   - Login en organización no vinculada -> `403 Forbidden`.
   - Omitir `X-CSRF-Token` en POST -> `403 Forbidden`.
   - Intentar invitar rol `APPROVER` -> `403 Forbidden`.
   - Respuesta de login sin token en body JSON -> verificado.
   - Reutilización de invitación -> `400 INVITATION_REUSED`.
3. **Validador Interno `validate_v0.3.13.cjs`:** Retorna `7/7 PASS` garantizando portabilidad sin enlaces `file:///` rotos.
