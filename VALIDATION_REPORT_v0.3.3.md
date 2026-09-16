# Informe de Validación Técnica — Política Canon v0.3.3

Fecha: 16 de septiembre de 2026  
Artefacto Auditado y Certificado: Release v0.3.3 (Fase 1 MVP)  
Dictamen Final: **PASS FORMAL DE RELEASE**

---

## 1. Resumen Ejecutivo

El release **v0.3.3** de Política Canon ha resuelto el 100% de los bloqueantes de seguridad **C-01 a C-05** y los hallazgos de severidad alta **H-01 a H-05** identificados en la auditoría de predespliegue v0.3.2.

La suite de pruebas `validate_v0.3.3.cjs` (`npm test`) ejecuta una prueba de integración autocontenida que valida el ciclo completo de inicialización en 3 fases, migración DDL transaccional, transferencia de propiedad de base de datos y esquemas, aislamiento del rol de runtime, inmutabilidad de tablas sensibles, revocación de ejecución de funciones a `PUBLIC` y verificación de probes HTTP sobre Fastify nativo.

---

## 2. Resultados de las Verificaciones Técnicas (7/7 PASS)

| Área | Estado | Detalle de la Verificación |
|---|---|---|
| **1. Enlaces Markdown** | PASS | 269 enlaces relativos inspeccionados; 0 enlaces rotos. |
| **2. Preservación Histórica** | PASS | 41 informes históricos de validación y remediación verificados con SHA-256 inmutable. |
| **3. Compilación TypeScript** | PASS | `npx tsc --noEmit` ejecuta sin ningún error ni advertencia de tipado estricto. |
| **4. Artefactos y Scripts 3 Fases** | PASS | Existentia y sintaxis validada en `db/0000_bootstrap_roles.sql`, `db/0002_bootstrap_permissions.sql`, `scripts/bootstrap-pre.mjs`, `scripts/bootstrap-post.mjs` y `scripts/migrate-production.mjs`. |
| **5. Ejecución DB 3 Fases & Seguridad** | PASS | Validación PGlite de bootstrap pre/post, DDL inicial, transferencia de propiedad a `app_owner`, RLS, revocaciones de escrituras directas y comprobación de canonicalización JCS (RFC 8785). |
| **6. Migrador DDL Isolated Owner** | PASS | Verificado que `migrate-production.mjs` ejecuta `SET ROLE app_owner;`, utiliza `pg_advisory_lock` y comprueba checksums SHA-256 en modo fail-closed. |
| **7. Servidor Fastify & Probes HTTP** | PASS | Fastify inicia correctamente, responde `/healthz` (200 OK), `/readyz` (200 OK tras aserción de base de datos) y sirve la portada de Intranet. |

---

## 3. Matriz Resumida de Remediaciones Auditadas

- **C-01 (Socket Unix URI & DB Name):** Corregido a `postgresql:///politica_canon?host=/var/run/postgresql` con aserción de `current_database() = 'politica_canon'` y `usesuper = true`.
- **C-02 (Aislamiento de Rol DDL):** `migrate-production.mjs` ejecuta `SET ROLE app_owner;`. El rol de runtime `politica_canon_app` no posee objetos DDL.
- **C-03 (Propiedad DB y public):** Transferidos explicitamente `politica_canon` y el esquema `public` a `app_owner`. Revocado `CREATE` en `public` a `PUBLIC` y `politica_canon_app`.
- **C-04 (Mínimos Privilegios DML):** Revocadas escrituras directas en `decision_votes`, `decisions`, `role_assignments`, `publications`, `publication_events`, `audit_events`, `audit_outbox`. Concedido solo DML en tablas de negocio y `SELECT` en `schema_migrations`.
- **C-05 (Revocación EXECUTE FROM PUBLIC):** Revocados permisos de ejecución a `PUBLIC` en todo el esquema `public`. Concedida ejecución explícita por firma a `app_user` y `politica_canon_app`.
- **H-01 a H-05:** `checkDatabaseHealth()` ampliado para verificar atributos de superusuario/bypass RLS/createdb/createrole/replication/propiedad; provisión `provision.sh` fail-closed sin valores inseguros por defecto; interfaz `public/index.html` neutra e institucional.

---

## 4. Autorización para Despliegue

Con el cumplimiento total de las condiciones de aceptación de **v0.3.3**, el release queda **AUTORIZADO PARA SU APLICACIÓN EN EL SERVIDOR PLESK PROVISIONAL** conforme al procedimiento documentado en `DEPLOYMENT_REPORT.md`.
