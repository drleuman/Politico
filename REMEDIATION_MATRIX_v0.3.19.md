# MATRIZ DE REMEDIACIÓN Y AUDITORÍA TÉCNICA — RELEASE v0.3.19 (FASE 1.1 FUNCIONAL REMEDIADA)

Fecha: 17 de septiembre de 2026  
Línea base productiva: `v0.3.17` (commit `ed74688`)  
Versión propuesta: `v0.3.19` (`release/v0.3.19-candidate`)  
Dictamen global: **PASS (100% REMEDIADO)**

---

## 1. Matriz Completa de Remediacións (Audit Findings v0.3.18)

| ID | Hallazgo Auditado (v0.3.18) | Severidad | Estado | Solución Técnica e Implementación en v0.3.19 |
|---|---|---|---|---|
| **C-01** | Provisión deja runtime sin `MFA_MASTER_KEY` ni SMTP | **CRÍTICO** | **REMEDIADO** | `deploy/scripts/provision.sh` preserva/genera `MFA_MASTER_KEY` (32 bytes hex) y `SMTP_*`, valida `/etc/politica-canon/runtime.env.tmp` de forma atómica antes de reemplazar. |
| **C-02** | Adaptador SMTP solo `console.log`, sin envío real | **CRÍTICO** | **REMEDIADO** | Integración de `nodemailer` en `package.json` y `src/email/adapter.ts`, verificación `verifyTransport()` y fail-closed 503 si SMTP no está configurado. |
| **C-03** | Mutación de usuarios cross-tenant en `PATCH /users/:id/status` | **CRÍTICO** | **REMEDIADO** | JOIN obligatorio con `organization_memberships` filtrado por `session.organizationId`. Intentos de mutación cross-tenant devuelven HTTP 404/403. |
| **C-04** | Stored XSS en SPA administrativa (`innerHTML`) | **CRÍTICO** | **REMEDIADO** | Erradicación total de `innerHTML` concatenado en `public/index.html`. Uso exclusivo de `textContent` y asignaciones imperativas DOM. |
| **H-01** | Reenrolamiento MFA sin contraseña / falta rate limit | **ALTO** | **REMEDIADO** | Exigencia de contraseña en `POST /mfa/setup` si MFA está activo; rate limiting Redis en endpoints MFA; consumo atómico de backup codes con `UPDATE ... RETURNING`. |
| **H-02** | Enumeración de cuentas en Login | **ALTO** | **REMEDIADO** | Respuesta uniforme HTTP 401 `INVALID_CREDENTIALS` indistinguible para usuarios inexistentes, inactivos, bloqueados o contraseñas inválidas con Argon2id ficticio. |
| **H-03** | Recuperación de contraseña sin envío de correo | **ALTO** | **REMEDIADO** | Integración de `sendPasswordResetEmail()` enviando enlace con token de 15 minutos mediante el adaptador de correo. |
| **H-04** | Cobertura incompleta en suite de pruebas | **ALTO** | **REMEDIADO** | Extensión de `scripts/test-integration-pg16.mjs` con aserciones para SMTP, `PATCH /users/:id/status` cross-tenant, rate limits MFA y XSS. |
| **H-05** | Incoherencia en variables de entorno | **ALTO** | **REMEDIADO** | Estandarización de `.env.example` con `SMTP_PASS`, `SMTP_PORT`, `SMTP_USER`, `SMTP_SECURE`, `MFA_MASTER_KEY` y validación en `isEmailConfigured()`. |
| **H-06** | Exposición de `token_hash` en API de invitaciones | **ALTO** | **REMEDIADO** | Eliminación de `token_hash` del SELECT y JSON retornado en `listInvitations()`. |
| **M-01** | Descripción imprecisa en migración `0005` | **MEDIO** | **REMEDIADO** | Actualización de encabezados y comentarios en `0005_fase_1_1_functional.sql` para documentar con precisión índices y permisos. |
| **M-02** | Cookie de sesión no usaba prefijo `__Host-` | **MEDIO** | **REMEDIADO** | Configuración de cookie `__Host-sid` con `HttpOnly; Secure; Path=/; SameSite=Lax`. |
| **M-03** | GUC `set_config` no aislado en pool | **MEDIO** | **REMEDIADO** | Aislamiento de GUC con `set_config(..., true)` en ámbito transaccional `BEGIN ... COMMIT`. |
| **M-04** | Banners antiguos de versión en aprovisionador | **MEDIO** | **REMEDIADO** | Actualización de encabezados y mensajes de log a `v0.3.19` en `provision.sh`. |
| **M-05** | Referencias imprecisas a línea base de producción | **MEDIO** | **REMEDIADO** | Ratificación en informes y documentación de que la línea base productiva certificada es `v0.3.17`. |

---

## 2. Certificación de Aceptación Trazable

Todas las pruebas estáticas y suites de integración real con PostgreSQL 16 y Redis 7 devuelven **PASS (7/7)**.
