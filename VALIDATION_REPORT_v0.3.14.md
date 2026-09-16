# Reporte Formal de Validaciones Pre-Despliegue — Política Canon v0.3.14

**Fecha:** 16 de septiembre de 2026  
**Release:** `v0.3.14` (Fase 1.1 Correctiva — Identidad, Invitaciones, Sesiones, RBAC/ABAC y Resolutores FORCE RLS)  
**Estado:** `AUDITADO Y CORRECTIVO — LISTO PARA REVISIÓN HUMANA (NO DESPLEGAR A PRODUCCIÓN)`

---

## 1. Resumen Ejecutivo de Validación

Se ha completado el release correctivo **v0.3.14**, el cual subsana los dos bloqueadores identificados en la auditoría del release v0.3.13:

1. **Resolutores de Tokens compatibles con `FORCE ROW LEVEL SECURITY`:** Se creó el rol acotado `token_resolver` (`BYPASSRLS`) que ostenta la propiedad de las funciones `SECURITY DEFINER` de resolución por hash (`resolve_session_by_token`, `resolve_invitation_by_token`, `get_user_active_memberships`). Esto permite resolver tokens por hash exacto cuando aún no se conoce la organización, manteniendo `FORCE RLS` estricto para el resto de la aplicación.
2. **MFA Obligatorio y Reciente para Gestión de Invitaciones:** `POST`, `GET` y `DELETE /api/v1/invitations` exigen de manera estricta que el usuario tenga MFA habilitado (`mfaEnabled === true`) **y** que la verificación se haya realizado en los últimos 15 minutos (`mfaAgeSeconds <= 900`).

---

## 2. Inventario de Archivos del Release v0.3.14

| Componente | Archivos Principales |
|---|---|
| **Base de Datos & Roles** | [`db/0000_bootstrap_roles.sql`](db/0000_bootstrap_roles.sql), [`db/0002_bootstrap_permissions.sql`](db/0002_bootstrap_permissions.sql), [`db/migrations/0003_fase_1_1_identity_rbac.sql`](db/migrations/0003_fase_1_1_identity_rbac.sql) |
| **Módulos Core & Rutas** | [`src/auth/routes.ts`](src/auth/routes.ts), [`src/server.ts`](src/server.ts) |
| **Pruebas & Validación** | [`scripts/test-integration-pg16.mjs`](scripts/test-integration-pg16.mjs), [`validate_v0.3.14.cjs`](validate_v0.3.14.cjs) |
| **Matriz de Remediación** | [`REMEDIATION_MATRIX_v0.3.14.md`](REMEDIATION_MATRIX_v0.3.14.md) |
| **Empaquetado** | `politica-canon-v0.3.14.zip`, `MANIFEST_v0.3.14.json` |

---

## 3. Pruebas Automáticas y Verificación Mecánica

- **Compilación TypeScript (`tsc --build`):** Exitosa sin errores.
- **Validador Estático (`validate_v0.3.14.cjs`):** 7/7 PASS.
  - Enlaces Markdown: 0 enlaces rotos, 0 esquemas `file:///` absolutos.
  - Preservación Criptográfica: 63 informes históricos verificados.
- **Suite de Integración Real (`npm test`):**
  - PostgreSQL 16 real y Redis 7 real en Docker Compose.
  - Resolución de sesión e invitación probada con `FORCE RLS` activo.
  - Rechazo de Admin sin MFA configurado (HTTP 403).
  - Rechazo de Admin con MFA vencido (>15 min) (HTTP 403).
  - Éxito únicamente con MFA habilitado y verificado (<15 min).
