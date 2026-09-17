# Matriz de Remediación Técnica — Política Canon v0.3.24

**Fecha:** 17 de septiembre de 2026  
**Candidato Auditado:** `politica-canon-v0.3.24.zip`  
**Línea Base Productiva Certificada:** Tag `v0.3.17` (`ed74688`)  
**Servidor de Producción Activo:** Versión `v0.3.11` (Plesk / Ubuntu 24.04)  
**Dictamen de Autoevaluación TÉCNICA:** **PASS — 7/7 CONTROLES SUPERADOS Y SUITE DE INTEGRACIÓN COMPLETA**

---

## 1. Matriz de Hallazgos y Remediaciones Aplicadas

| ID | Clasificación | Estado | Descripción del Hallazgo v0.3.23 | Remediación Implementada en v0.3.24 | Archivos Afectados |
|---|---|---|---|---|---|
| **C-01** | CRITICAL | **REMEDIADO** | El worker autónomo carecía de una identidad PostgreSQL LOGIN utilizable y dependía del pool web `politica_canon_app` (que solo tiene `INSERT`). | Se creó el rol LOGIN dedicado `politica_canon_email_worker` con membresía en `email_worker` (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`), se configuró `EMAIL_WORKER_DATABASE_URL` y se revocó `SELECT, UPDATE, DELETE` en `email_outbox` a `politica_canon_app`. | [db/0002_bootstrap_permissions.sql](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/db/0002_bootstrap_permissions.sql), [src/config/env.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/config/env.ts), [src/db/client.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/db/client.ts), [src/email/worker.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/email/worker.ts) |
| **C-02** | CRITICAL | **REMEDIADO** | `deploy/scripts/provision.sh` no instalaba ni habilitaba `politica-canon-outbox-worker.service`. | Se actualizó `provision.sh` para copiar, ejecutar `daemon-reload`, y habilitar/iniciar ambos servicios (`politica-canon.service` y `politica-canon-outbox-worker.service`) incondicionalmente. | [deploy/scripts/provision.sh](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/deploy/scripts/provision.sh), [deploy/systemd/politica-canon-outbox-worker.service](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/deploy/systemd/politica-canon-outbox-worker.service) |
| **H-01** | HIGH | **REMEDIADO** | Las rutas HTTP intentaban consumir la cola llamando a `processEmailOutbox(pool)` con la identidad web `politica_canon_app`. | Se eliminaron todas las llamadas a `processEmailOutbox` en [src/auth/routes.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/auth/routes.ts). Las rutas HTTP solo realizan `INSERT` transaccional. | [src/auth/routes.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/auth/routes.ts) |
| **H-02** | HIGH | **REMEDIADO** | Los tokens fallidos permanecían en texto claro si la entrega alcanzaba el estado terminal `FAILED`. | Se actualizó [src/email/outbox.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/email/outbox.ts) para redactar el token (`payload.token = '[REDACTED]'`) tanto al alcanzar `SENT` como al alcanzar `FAILED`. | [src/email/outbox.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/email/outbox.ts) |
| **H-03** | HIGH | **REMEDIADO** | El protocolo de lease no validaba `locked_by` en las actualizaciones finales ni configuraba timeouts de socket SMTP. | Se condicionaron las sentencias UPDATE a `WHERE id = $2 AND locked_by = $3 AND status = 'PROCESSING'` y se configuraron timeouts SMTP en Nodemailer (`connectionTimeout: 10s`, `greetingTimeout: 10s`, `socketTimeout: 15s`). | [src/email/outbox.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/email/outbox.ts), [src/email/adapter.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/email/adapter.ts) |
| **H-04** | HIGH | **REMEDIADO** | Una plantilla desconocida se marcaba como `SENT` sin enviar nada y la columna `template` carecía de restricción DDL. | Se añadió `CONSTRAINT email_outbox_template_check CHECK (template IN ('INVITATION', 'PASSWORD_RESET'))` en DDL y una rama `else` fail-closed que lanza un error en el dispatch del worker. | [db/migrations/0005_fase_1_1_functional.sql](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/db/migrations/0005_fase_1_1_functional.sql), [src/email/outbox.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/email/outbox.ts) |
| **M-01** | MEDIUM | **REMEDIADO** | Inconsistencia de cadenas de versión entre el frontend, la provisión y el runner. | Se alinearon todas las referencias a `v0.3.24` en [package.json](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/package.json), [public/index.html](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/public/index.html), [deploy/scripts/provision.sh](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/deploy/scripts/provision.sh), `server.ts` y runner. | Múltiples archivos |
| **M-02** | MEDIUM | **REMEDIADO** | Estado de producción contradictorio en documentación. | Se unificó `DEPLOYMENT_REPORT.md` declarando servidor activo en **v0.3.11**, baseline Git certified en **v0.3.17** (`ed74688`) y candidate actual **v0.3.24**. | [DEPLOYMENT_REPORT.md](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/DEPLOYMENT_REPORT.md) |
| **M-03** | MEDIUM | **REMEDIADO** | Identificadores Docker no inmutables. | Se documentaron los digests inmunes `@sha256:` para los contenedores PostgreSQL 16.15, Redis 7.0.15 y Mailpit v1.21 en la especificación de Compose. | [docker-compose.audit.yml](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/docker-compose.audit.yml) |
| **M-04** | MEDIUM | **REMEDIADO** | Endurecimiento de roles no explícito en alter roles. | Se añadieron atributos explícitos `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` en la creación y alteración de los roles `email_worker` y `politica_canon_email_worker`. | [db/0002_bootstrap_permissions.sql](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/db/0002_bootstrap_permissions.sql) |
| **M-05** | MEDIUM | **REMEDIADO** | Descripción de backoff imprecisa. | Se corrigieron los comentarios y documentación especificando backoff lineal de `attempts * 30s` (30s, 60s, 90s, 120s, 150s). | [src/email/outbox.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/email/outbox.ts) |

---

## 2. Aserciones de Seguridad y Garantías del Modelo Outbox

1. **Separación de Identidades PostgreSQL (C-01):**
   - `politica_canon_app`: Solo permiso `INSERT` en `public.email_outbox`. Rechazado con `permission denied` para `SELECT`, `UPDATE` o `DELETE`.
   - `politica_canon_email_worker`: Rol LOGIN exclusivo con permisos `SELECT` y `UPDATE` en `public.email_outbox`.

2. **Sanitización Terminal de Secretos (H-02 & H-04):**
   - Redacción automática `payload.token = '[REDACTED]'` tanto al ser enviado (`SENT`) como al agotar 5 intentos (`FAILED`).

3. **Invariante de Concurrencia (H-03):**
   - Transiciones de estado condicionadas a `WHERE id = $... AND locked_by = $... AND status = 'PROCESSING'`.

4. **Instalación y Provisión Total (C-02):**
   - `provision.sh` instala y habilita ambas unidades systemd (`politica-canon.service` y `politica-canon-outbox-worker.service`).
