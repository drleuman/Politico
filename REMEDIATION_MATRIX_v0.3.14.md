# Matriz de Remediación Técnica y Auditoría — Política Canon v0.3.14

**Fecha:** 16 de septiembre de 2026  
**Release:** `v0.3.14` (Fase 1.1 Correctiva — Identidad, Invitaciones, Sesiones, RBAC/ABAC y Resolutores FORCE RLS)  
**Estado:** `REMEDIADO — LISTO PARA REVISIÓN (NO DESPLEGAR A PRODUCCIÓN — SERVIDOR PERMANECE EN v0.3.11)`

---

## 1. Resumen de Hallazgos de Auditoría y Remediación Técnica

| ID | Severidad | Hallazgo Original Auditoría v0.3.13 | Estado v0.3.14 | Componente / Archivo Afectado | Solución Técnica Aplicada |
|---|---|---|---|---|---|
| **SEC-09** | Crítico | Resolutores `resolve_session_by_token` y `resolve_invitation_by_token` pertenecían a `app_owner` (`NOBYPASSRLS`). Con `FORCE RLS` activo y sin GUC, la consulta no podía leer la fila. | **Remediado** | [`db/0000_bootstrap_roles.sql`](db/0000_bootstrap_roles.sql), [`db/0002_bootstrap_permissions.sql`](db/0002_bootstrap_permissions.sql), [`db/migrations/0003_fase_1_1_identity_rbac.sql`](db/migrations/0003_fase_1_1_identity_rbac.sql) | Creado el rol desacoplado `token_resolver` con la atribución `BYPASSRLS`. Las funciones `SECURITY DEFINER` de resolución por hash son propiedad exclusiva de `token_resolver`, permitiendo la lectura acotada por hash único bajo `FORCE RLS`. |
| **SEC-10** | Alto | Gestión de invitaciones permitía operar a `ADMIN`/`COORDINATOR` **sin MFA** si aún no la tenían habilitada. Listado de invitaciones no comprobaba MFA reciente. | **Remediado** | [`src/auth/routes.ts`](src/auth/routes.ts) | Imposición estricta en `POST`, `GET` y `DELETE /api/v1/invitations`: exige que `user.mfaEnabled === true` **y** `mfaAgeSeconds <= 900` (frescura <= 15 min). Se rechaza con `403 Forbidden` (`MFA_REQUIRED`) si no está habilitado o está vencido. |

---

## 2. Verificación y Evidencia Adversarial (v0.3.14)

1. **Catálogo PG16 Real & Docker Compose:** Se agregaron aserciones del catálogo PostgreSQL 16 para verificar que `token_resolver` posee `rolbypassrls = true`.
2. **Pruebas Adversariales Integradas:**
   - **FORCE RLS Resolution:** Verificada la resolución exitosa de token de sesión e invitación ejecutada como `politica_canon_app` con `FORCE RLS` activo en `user_sessions` e `invitations`.
   - **Rechazo Admin SIN MFA:** Verificado rechazo con `403 Forbidden` (`MFA_REQUIRED`) al intentar crear o consultar invitaciones desde cuenta `ADMIN` con `mfa_enabled = FALSE`.
   - **Rechazo Admin con MFA Vencido:** Simulación de sesión con `mfa_verified_at` con antigüedad de 20 minutos (>900s) $\rightarrow$ Rechazo con `403 Forbidden` (`MFA_REQUIRED`).
   - **Éxito con MFA Habilitado y Reciente:** Verificada la creación (`HTTP 201`) y consulta (`HTTP 200`) de invitaciones tras confirmar MFA reciente (<15 min).
3. **Validador Estático `validate_v0.3.14.cjs`:**
   - **`7/7 PASS`**.
   - 311 enlaces Markdown portables inspeccionados.
   - 63 informes históricos inmutables preservados.
