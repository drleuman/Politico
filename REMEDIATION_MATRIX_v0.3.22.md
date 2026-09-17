# Matriz de Remediación Integral — Release Candidate v0.3.22

**Fecha:** 17 de septiembre de 2026  
**Rama:** `release/v0.3.22-candidate`  
**Paquete:** `politica-canon-v0.3.22.zip`  
**Manifiesto:** `MANIFEST_v0.3.22.json`  

---

## 1. Resumen de Remediaciones (v0.3.21 → v0.3.22)

| ID | Severidad | Hallazgo | Estado v0.3.22 | Solución Implementada |
| :--- | :--- | :--- | :--- | :--- |
| **C-01** | Crítico | Restablecimiento de contraseña no revocaba sesiones RLS por falta de GUC tenant | **REMEDIADO** | Se agregó la función SECURITY DEFINER `revoke_all_user_sessions_sec(UUID)` para revocar todas las sesiones incondicionalmente. En `forgot-password` y `reset-password` se resuelve la organización activa del usuario vía `get_user_active_memberships(userId)` y se establece `app.current_organization_id` antes de auditar. |
| **C-02** | Crítico | Bypass jerárquico cuando el usuario objetivo posee múltiples roles (WRITER + ADMIN) | **REMEDIADO** | `PATCH /api/v1/users/:id/status` evalúa el arreglo completo de roles activos (`targetRoles`). Si el objetivo posee el rol `ADMIN` en cualquiera de sus asignaciones, un actor no-admin (`COORDINATOR`) es rechazado con HTTP 403 `HIERARCHY_VIOLATION`. |
| **C-03** | Crítico | Ausencia de Outbox transaccional para operaciones de correo (invitación/reset) | **REMEDIADO** | Se creó la tabla `email_outbox` y el módulo `src/email/outbox.ts`. Las rutas HTTP encolan los correos dentro de la transacción de base de datos e inmediatamente retornan HTTP 200/201. Un procesador asíncrono e idempotente desacola y transmite vía SMTP. |
| **H-01** | Alto | Validador de artefactos fail-open | **REMEDIADO** | `validate_v0.3.22.cjs` falla inmediatamente (exit code 1) si el ZIP o el manifiesto no están presentes. Calcula SHA-256, tamaño, conteo físico de entradas, valida la raíz `politica-canon-v0.3.22/` y comprueba la ausencia de archivos prohibidos (`.git`, `node_modules`, `dist`, `.env`). |
| **H-02** | Alto | Runner de integración incompleto | **REMEDIADO** | `scripts/test-integration-pg16.mjs` incorpora pruebas E2E de restablecimiento de contraseña con revocación de sesiones, outbox SMTP con manejo de errores, rate limit de MFA y jerarquía de múltiples roles (WRITER+ADMIN). |
| **H-03** | Alto | Estado productivo contradictorio en documentación | **REMEDIADO** | Se alineó toda la documentación (`DEPLOYMENT_REPORT.md`, `REMEDIATION_MATRIX`, `VALIDATION_REPORT`): la producción activa está en `v0.3.11`, la línea base certificada en Git es `v0.3.17` (`ed74688`). |
| **M-01** | Medio | Metadatos de versión incoherentes | **REMEDIADO** | Versión `v0.3.22` unificada en `package.json`, `src/server.ts`, `deploy/scripts/provision.sh`, `deploy/systemd/politica-canon.service` y `public/index.html`. |
| **M-02** | Medio | Imagen Mailpit sin tag inmutable | **REMEDIADO** | `docker-compose.audit.yml` fija la imagen a `axllent/mailpit:v1.21`. |
| **M-03** | Medio | Carrera al iniciar Mailpit en pruebas | **REMEDIADO** | El runner espera explícitamente la disponibilidad de la API REST de Mailpit (puerto 18025) y SMTP (11025) antes de ejecutar pruebas de correo. |

---

## 2. Estado de Gobernanza

* **Draft PR (`release/v0.3.22-candidate → main`):** Preparado localmente.
* **Fusión a `main`:** **NO AUTORIZADA** hasta superación de auditoría independiente.
* **Tag Git `v0.3.22`:** **NO CREADO**.
* **Despliegue a Producción:** **NO EJECUTADO**.
