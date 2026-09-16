# Matriz de Remediación y Resolución de Hallazgos — Release v0.3.1

**Fecha:** 16 de septiembre de 2026  
**Auditoría Origen:** Auditoría Externa de Release `v0.3.0`  
**Estado General:** **REMEDIADO 100% — RELEASE v0.3.1 APROBADO Y LISTO PARA DESPLIEGUE**

---

## Matriz Resumen de Hallazgos y Correcciones Exigidas

| ID Hallazgo | Descripción / Evidencia Auditada | Impacto Identificado | Corrección Aplicada en Release v0.3.1 | Estado |
|---|---|---|---|---|
| **C-01** | `npm test` fallaba en checkout limpio por falta de `dist/server.js`. | Fallo en la suite de pruebas automatizadas sin `npm run build` previo. | Se redefinía `"test": "npm run build && node validate_v0.3.1.cjs"` en `package.json`, asegurando que `npm test` sea 100% autocontenido en repositorios clonados desde cero. | **REMEDIADO** |
| **C-02** | Migrador no aplicaba el modelo de seguridad ni roles canónicos. | Conexión de app con rol sin RLS / permisos de propietario inadecuados. | Se separó explícitamente `scripts/bootstrap-database.mjs` (`npm run bootstrap:prod`) ejecutado como superusuario para roles, de `scripts/migrate-production.mjs` (`npm run migrate:prod`) para parches DDL. | **REMEDIADO** |
| **H-01** | Carrera y deriva potencial de migraciones sin bloqueo concurente ni fail-closed. | Riesgo de inconsistencia DDL concurrente o modificación de parches. | Se añadió `SELECT pg_advisory_lock(87850301);` y verificación estricta de checksums SHA-256 en `scripts/migrate-production.mjs` con aborto fail-closed por `CHECKSUM_MISMATCH`. | **REMEDIADO** |
| **H-02** | `vhost_nginx.conf` mantenía `auth_basic` comentado y portada sin protección real. | Exposición pública no autorizada del dominio Plesk. | Se activó `auth_basic "Acceso Restringido — Intranet Política Canon";` y `auth_basic_user_file` en `deploy/plesk/vhost_nginx.conf`. | **REMEDIADO** |
| **H-03** | Script de provisión `provision.sh` no generaba secreto de sesión ni variables obligatorias. | Servicio en fallo cerrado al arrancar sin variables. | Se implementó la generación automática de `SESSION_SECRET` de 32+ bytes (`openssl rand -hex 32`) en `deploy/scripts/provision.sh`. | **REMEDIADO** |
