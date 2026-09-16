# Matriz de Remediación y Resolución de Hallazgos — Release v0.3.0

**Fecha:** 16 de septiembre de 2026  
**Auditoría Origen:** Auditoría de Predespliegue `Politico-main`  
**Estado General:** **REMEDIADO 100% — RELEASE v0.3.0 LISTO PARA AUDITORÍA EXTERNA FINAL**

---

## Matriz Resumen de Hallazgos y Correcciones Exigidas

| ID Hallazgo | Descripción / Evidencia Auditada | Impacto Identificado | Corrección Aplicada en Release v0.3.0 | Estado |
|---|---|---|---|---|
| **B-01** | Integridad de release v0.2.18 modificada. | Bloqueador de trazabilidad canónica. | Se restauró `politica-canon-v0.2.18.zip` e informe histórico a su SHA-256 histórico original (`5d7c18e99be808709d28f6028c42d4b823348c35a062dd547ad2bcd3f0fa043b`). Se emitió nueva versión formal **v0.3.0**. | **REMEDIADO** |
| **B-02** | Manifiesto v0.2.18 contradictorio. | Incoherencia en auditoría externa. | Se creó `MANIFEST_v0.3.0.json` alineado en versión, fecha, hash y dictamen formal para `v0.3.0`. | **REMEDIADO** |
| **B-03** | Ausencia de script migrador ejecutable e idempotente. | Riesgo de fallos de despliegue en BD. | Se incorporó `scripts/migrate-production.mjs` que aplica DDLs en orden atómico transaccional y registra el estado en la tabla `schema_migrations`. | **REMEDIADO** |
| **B-04** | Falta de artefactos de despliegue versionados. | Incumplimiento de provisión reproducible. | Se añadieron `deploy/systemd/politica-canon.service`, `deploy/plesk/vhost_nginx.conf` y `deploy/scripts/provision.sh`. | **REMEDIADO** |
| **B-05** | Portada pública exponía metadatos de plataforma sin autenticación real. | Exposición de información de infraestructura. | Se transformó `public/index.html` en un portal de login de Intranet Privada sin metadatos de runtime ni versiones públicas. | **REMEDIADO** |
| **H-01** | Comando de backup de BD usaba `sudo pg_dump` en lugar de `sudo -u postgres`. | Error de autenticación peer en PostgreSQL. | Se actualizó `DEPLOYMENT_REPORT.md` y scripts para usar `sudo -u postgres pg_dump ...`. | **REMEDIADO** |
| **H-02** | Pool de conexiones PostgreSQL fijado en max=20. | Exceso de conexiones límite del rol `politica-canon_app`. | Se redujo el pool `max` a 10 en `src/db/client.ts`. | **REMEDIADO** |
| **H-03** | Falta de pruebas HTTP reales de probes `/healthz` y `/readyz`. | Ausencia de verificación de probes en suite. | Se agregaron pruebas de inyección Fastify HTTP en `validate_v0.3.0.cjs` (`npm test`). | **REMEDIADO** |
| **H-04** | Ausencia de apagado controlado (*graceful shutdown*). | Fuga de sockets y pools en reinicio de proceso. | Se agregaron hooks `SIGTERM`/`SIGINT` en `src/server.ts` invocando `closeDbPool()` y `closeRedisClient()`. | **REMEDIADO** |
| **H-05** | Cadena `DATABASE_URL` con contraseña de ejemplo en documentación. | Riesgo de duplicar credenciales. | Se eliminaron cadenas de contraseñas de ejemplo de `DEPLOYMENT_REPORT.md`. | **REMEDIADO** |
