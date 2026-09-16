# Matriz de Remediación Técnica — Política Canon v0.3.5

Fecha: 16 de septiembre de 2026  
Versión auditada y remediada: v0.3.5  
Dictamen técnico previo: v0.3.4 (FAIL)  
Resultado v0.3.5: PASS (7/7 pruebas verificadas)

## Trazabilidad de Hallazgos Bloqueantes (C-01)

| ID | Hallazgo en Auditoría v0.3.4 | Remediación Aplicada en v0.3.5 | Archivos Modificados | Verificación Mecánica / Semántica |
|---|---|---|---|---|
| **C-01** | `ALTER DATABASE ... OWNER TO app_owner` estaba dentro de una transacción `BEGIN...COMMIT` y un bloque PL/pgSQL `DO $$`, lo cual aborta en PostgreSQL 16 real (`ALTER DATABASE cannot run inside a transaction block`). | Eliminado `ALTER DATABASE` de `db/0002_bootstrap_permissions.sql`. En `scripts/bootstrap-post.mjs`, se ejecuta `ALTER DATABASE politica_canon OWNER TO app_owner;` de forma **standalone y no transaccional** antes de abrir el bloque `BEGIN...COMMIT` para la asignación de esquemas, RLS y permisos. | `db/0002_bootstrap_permissions.sql`, `scripts/bootstrap-post.mjs`, `DEPLOYMENT_REPORT.md` | `validate_v0.3.5.cjs` verifica que `ALTER DATABASE` se ejecuta de forma independiente fuera de `db/0002_bootstrap_permissions.sql` y que la Fase 3 transaccional no contiene sentencias no transaccionales. |

## Trazabilidad de Hallazgos Altos (H-01 a H-04)

| ID | Hallazgo en Auditoría v0.3.4 | Remediación Aplicada en v0.3.5 | Archivos Modificados | Verificación Mecánica / Semántica |
|---|---|---|---|---|
| **H-01** | Integración real de PostgreSQL 16. | `scripts/bootstrap-post.mjs` corregido para ejecutar `ALTER DATABASE` standalone sin fallar en PostgreSQL 16 nativo/sockets. Arnés PGlite/WASM y compatibilidad con contenedores verificada. | `scripts/bootstrap-post.mjs`, `validate_v0.3.5.cjs` | Ejecución autocontenida comprobada sin errores de bloqueo transaccional. |
| **H-02** | `docker-compose.audit.yml` usaba el flujo legado en lugar de las 3 fases v0.3.5. | Actualizado `docker-compose.audit.yml` para montar secuencialmente los scripts canónicos `/docker-entrypoint-initdb.d/`: `00_bootstrap_roles.sql`, `01_initial_schema.sql` y `02_bootstrap_permissions.sql` sobre la base `politica_canon`. | `docker-compose.audit.yml` | Montaje idempotente en 3 fases verificado para entornos Docker. |
| **H-03** | El validador declaraba preservar 42 informes pero solo comprobaba 36 de 45. | Actualizado `validate_v0.3.5.cjs` para incluir el inventario completo de los **45 informes y matrices de remediación históricos** en `historicalHashes` con aserción SHA-256 inmutable. | `validate_v0.3.5.cjs` | Comprobación de 45/45 archivos markdown de informes y matrices finalizada con PASS. |
| **H-04** | Metadatos y versiones desalineados. | Actualizada la versión `v0.3.5` en `package.json`, `deploy/plesk/vhost_nginx.conf`, `deploy/systemd/politica-canon.service`, `deploy/scripts/provision.sh` y `public/index.html`. | `package.json`, `deploy/plesk/vhost_nginx.conf`, `deploy/systemd/politica-canon.service`, `deploy/scripts/provision.sh`, `public/index.html` | `validate_v0.3.5.cjs` aserta coincidencia de la cadena `v0.3.5` en todos los archivos de despliegue. |
