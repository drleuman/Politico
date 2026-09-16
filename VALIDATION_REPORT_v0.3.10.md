# Informe de Validación Técnica — Política Canon v0.3.10

**Fecha:** 16 de septiembre de 2026  
**Artefacto Auditado y Certificado:** Release v0.3.10 (Fase 1 MVP)  
**Resultado de Validación:** **PASS (100% de Verificaciones Satisfactorias — 8/8 Pruebas Exitosas + Integración Estricta PG16 / Redis en `npm test`)**

---

## 1. Resumen de la Remediación v0.3.10

El release **v0.3.10** de Política Canon codifica en el repositorio los ajustes descubiertos y aplicados durante el primer despliegue real en Plesk / Ubuntu 24.04:

1. **Consulta de Sonda de Salud (`src/db/client.ts`):** Corregida a `pg_roles` usando columnas exactas `rolsuper`, `rolbypassrls`, `rolcreatedb`, `rolcreaterole`, `rolreplication` y `rolname = current_user`.
2. **Permisos de Conexión Mínimos (`db/0002_bootstrap_permissions.sql`):** Concedido `GRANT CONNECT ON DATABASE politica_canon TO politica_canon_app;` en post-bootstrap.
3. **Extensión `pgcrypto` Pre-Bootstrap (`db/0000_bootstrap_roles.sql`):** Ejecutada de manera idempotente como superusuario `postgres` previo a `SET ROLE app_owner`.
4. **Provisionamiento Compatible (`deploy/scripts/provision.sh`):** Extracción de `POLITICA_CANON_DATABASE_URL` / `DATABASE_URL`, creación de directorio de caché npm `/opt/politica-canon/.npm-cache`, y escritura segura de `/etc/politica-canon/runtime.env` (`root:politica-canon` 0640) sin imprimir secretos.
5. **Permisos Reproducibles:** Directorios `/opt/politica-canon` y `/opt/politica-canon/app` atravesables (`0755`) para permitir ejecuciones de bootstrap por parte de `postgres`.
6. **Backup Pre-Migración Seguro:** Patrón `sudo -u postgres pg_dump --format=custom politica_canon > "$backup"` con `chmod 0600`.
7. **Proxy Dual Nginx + Apache en Plesk:** Directiva `auth_basic` en ámbito de servidor Nginx (sin `location /` duplicado); directivas Apache `ProxyPass` / `ProxyPassReverse` y `htpasswd` `root:nginx` (0640).
8. **Consistencia de Versión y Calidad:** Metadatos sincronizados a `v0.3.10` en todo el repositorio.

---

## 2. Resumen de Verificaciones de Pruebas

| Verificación | Estado | Detalle |
|---|---|---|
| **1. Enlaces Relativos Markdown** | PASS | Todos los enlaces validados sin ninguna rotura. |
| **2. Preservación Criptográfica Histórica** | PASS | 55 informes y matrices verificados por SHA-256 (incluyendo v0.3.9). |
| **3. Compilación TypeScript Estricta** | PASS | `tsc --noEmit` completado sin errores. |
| **4. Coherencia Metadatos v0.3.10** | PASS | Coherencia de versión `0.3.10` en todos los artefactos y `DEPLOYMENT_REPORT.md`. |
| **5. Inicialización de 3 Fases y Permisos** | PASS | `bootstrap:pre`, `migrate:prod`, `bootstrap:post`, `GRANT CONNECT` e inmutabilidad de tablas de gobernanza. |
| **6. Sonda de Salud y pg_roles** | PASS | `checkDatabaseHealth()` verificado usando `pg_roles` y `rolsuper` / `rolname`. |
| **7. Migrador DDL y Post-Bootstrap Fail-Closed** | PASS | `SET ROLE app_owner` obligatorio, `ALTER DATABASE` standalone y aserción de `datdba = app_owner` en catálogo. |
| **8. Inclusión Directa de Integración Real PG16/Redis en `npm test`** | PASS | `package.json` incluye `node scripts/test-integration-pg16.mjs` directamente en `npm test` con fail-closed `REAL_PG16_AND_REDIS_REQUIRED` y propagación `throw`. |

---

## 3. Dictamen de Despliegue

Con la codificación en el repositorio de todas las correcciones operativas del primer despliegue real en Plesk / Ubuntu 24.04, el release **v0.3.10** queda **AUTORIZADO PARA SU DESPLIEGUE EN PRODUCCIÓN / PLESK**.
