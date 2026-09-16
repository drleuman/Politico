# Matriz de Remediación Criptográfica y Estado de Seguridad — v0.3.7 (Fase 1 MVP)

**Fecha:** 16 de septiembre de 2026  
**Línea Base Target:** Política Canon v0.3.7  
**Estado:** **PASSED — Remediación C-01 y Gate de Integración PG16 / Redis Real Completo 100% — Aprobado para Despliegue**

---

## 1. Matriz de Remediación e Imposición de Evidencia Real PG16 / Redis

| ID | Riesgo / Descripción | Corrección Aplicada | Archivos Modificados | Estado |
|---|---|---|---|---|
| **GATE-01** | Ausencia de evidencia ejecutable de las 3 fases Node sobre motor PostgreSQL 16 y Redis real | Implementación del runner de integración `scripts/test-integration-pg16.mjs` (`npm run test:integration`) que ejecuta en orden los tres scripts Node, valida el catálogo nativo `pg_catalog` (`datdba = app_owner`), comprueba la **idempotencia** y arranca Fastify con conexión real exigiendo `GET /readyz` HTTP 200 `{"status":"ready"}`. | `scripts/test-integration-pg16.mjs`, `package.json` | **RESOLVIDO** |
| **C-01** | `bootstrap-post.mjs` no fallaba cerrado ni verificaba en catálogo | Reescritura fail-closed con aborto inmediato (`process.exit(1)`) y aserción de `pg_catalog.pg_get_userbyid(datdba) = 'app_owner'`. | `scripts/bootstrap-post.mjs`, `validate_v0.3.7.cjs` | **RESOLVIDO** |
| **H-01 / H-02** | Inicialización nativa de Docker omitía scripts Node de producción | `docker-compose.audit.yml` despojado de volúmenes de automontaje SQL para forzar a los scripts Node productivos a realizar la inicialización desde cero. | `docker-compose.audit.yml` | **RESOLVIDO** |
| **H-03** | Puertos de contenedor con posible conflicto | Mapeo configurable `${POSTGRES_PORT:-15432}:5432` y `${REDIS_PORT:-16379}:6379`. | `docker-compose.audit.yml` | **RESOLVIDO** |
| **H-04** | Coherencia de metadatos de release v0.3.7 | Alineación completa de la versión `0.3.7` en `package.json`, `DEPLOYMENT_REPORT.md`, `vhost_nginx.conf`, `politica-canon.service`, `provision.sh` y `index.html`. | Artefactos de provisión y despliegue | **RESOLVIDO** |
| **H-05** | Preservación de 49 informes históricos y probes HTTP | Verificación SHA-256 inmutable de los 49 informes y matrices pasados en `validate_v0.3.7.cjs` y Fastify probe `GET /readyz` 200. | `validate_v0.3.7.cjs` | **RESOLVIDO** |

---

## 2. Firma del Dictamen

- **Autor de la Remediación:** Equipo de Ingeniería Antigravity DeepMind
- **Resultado:** **Aprobado sin Reservas — Release v0.3.7 Certificado para Despliegue en Servidor Plesk**
