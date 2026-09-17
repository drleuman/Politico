# Matriz de Remediación Integral — Release Candidate v0.3.23

**Fecha:** 17 de septiembre de 2026  
**Rama:** `release/v0.3.23-candidate`  
**Paquete:** `politica-canon-v0.3.23.zip`  
**Manifiesto:** `MANIFEST_v0.3.23.json`  

---

## 1. Resumen de Remediaciones (v0.3.22 → v0.3.23)

| ID | Severidad | Hallazgo | Estado v0.3.23 | Solución Implementada |
| :--- | :--- | :--- | :--- | :--- |
| **C-01** | Crítico | SyntaxError en runner por bloque duplicado | **REMEDIADO** | Se eliminó el bloque duplicado en `scripts/test-integration-pg16.mjs`. Se incorporó el gate `node --check` previo a la ejecución y dentro del validador. |
| **C-02** | Crítico | Permisos de tabla `email_outbox` denegados a la aplicación runtime | **REMEDIADO** | En `db/0002_bootstrap_permissions.sql` se concedió únicamente `INSERT` a `app_user` / `politica_canon_app`. Se creó el rol dedicado `email_worker` con `SELECT, UPDATE` sobre `email_outbox`. Se agregaron aserciones post-bootstrap. |
| **C-03** | Crítico | Post-bootstrap revocaba la propiedad y ejecuto sobre `revoke_all_user_sessions_sec` | **REMEDIADO** | Se excluyó `revoke_all_user_sessions_sec` del bucle genérico de reseteo en `0002_bootstrap_permissions.sql`. Se mantuvo su propiedad en `token_resolver` (`BYPASSRLS`), con `EXECUTE` concedido a `app_user`. Se eliminó el fallback silencioso en `session.ts` y se probó la revocación multi-tenant en 2 organizaciones distintas. |
| **C-04** | Crítico | Worker outbox sin durabilidad, servicio ni concurrencia segura | **REMEDIADO** | Se implementó reclamación atómica vía `FOR UPDATE SKIP LOCKED`, estados (`PENDING`, `PROCESSING`, `SENT`, `FAILED`), reintentos con backoff, módulo de worker `src/email/worker.ts`, script `scripts/email-worker.mjs` y servicio systemd `deploy/systemd/politica-canon-outbox-worker.service`. |
| **H-01** | Alto | Validador invocaba `powershell` (incompatible con Linux/Ubuntu) | **REMEDIADO** | `validate_v0.3.23.cjs` utiliza un parser de directorio central de ZIP nativo en Node.js puro (manipulación de buffer sin subprocess ni binarios externos), funcionando 100% de forma multiplataforma en Linux/Ubuntu y Windows. |
| **H-02** | Alto | Validador declaraba PASS por búsquedas de texto sin probar sintaxis | **REMEDIADO** | `validate_v0.3.23.cjs` ejecuta `node --check` sobre los scripts de integración antes de certificar la suite. |
| **H-03** | Alto | Prueba de fallo SMTP no provocaba fallo real | **REMEDIADO** | Se incorporó prueba de fallo SMTP con servidor inalcanzable, verificando el registro de `last_error`, incremento de intentos y programación de reintento (`next_attempt_at`). |
| **H-04** | Alto | Retención de tokens secretos en texto claro dentro de `email_outbox` | **REMEDIADO** | `src/email/outbox.ts` redacta automáticamente el token del payload (`payload.token = '[REDACTED]'`) de forma atómica tras el envío exitoso. |
| **H-05** | Alto | Incoherencia de versión en la documentación de producción | **REMEDIADO** | Documentación unificada: producción viva en **`v0.3.11`**, línea base certificada en Git **`v0.3.17`** (`ed74688`). |
| **M-01** | Medio | Metadatos de versión desalineados | **REMEDIADO** | Versión `v0.3.23` unificada en `package.json`, `src/server.ts`, `deploy/scripts/provision.sh`, `deploy/systemd/`, `public/index.html`, `scripts/migrate-production.mjs` y `vhost_nginx.conf`. |
| **M-02** | Medio | Imágenes Docker sin tags/digests inmutables | **REMEDIADO** | `docker-compose.audit.yml` fija versiones inmutables: `postgres:16.15-alpine`, `redis:7.0.15-alpine`, `axllent/mailpit:v1.21`. |
| **M-03** | Medio | Texto de respuesta HTTP inexacto | **REMEDIADO** | `POST /api/v1/invitations` responde `'Invitación emitida y encolada para envío seguro.'` reflejando el estado real encolado. |

---

## 2. Estado de Gobernanza

* **Draft PR (`release/v0.3.23-candidate → main`):** Preparado.
* **Fusión a `main`:** **NO AUTORIZADA** hasta superación de auditoría independiente.
* **Tag Git `v0.3.23`:** **NO CREADO**.
* **Despliegue a Producción:** **NO EJECUTADO**.
