# Matriz de Remediación Criptográfica y Estado de Seguridad — v0.3.6 (Fase 1 MVP)

**Fecha:** 16 de septiembre de 2026  
**Línea Base Target:** Política Canon v0.3.6  
**Estado:** **PASSED — Remediación C-01 y H-01..H-05 Completa 100% — Aprobado para Despliegue**

---

## 1. Matriz de Remediación C-01 y Hallazgos H-01 a H-05

| ID | Riesgo / Descripción | Corrección Aplicada | Archivos Modificados | Estado |
|---|---|---|---|---|
| **C-01** | Post-bootstrap no fallaba cerrado si no transfería la propiedad de la base de datos `politica_canon` | Adición de aborto explícito (`process.exit(1)`) en caso de error en `ALTER DATABASE` y verificación obligatoria mediante `pg_catalog` (`datdba = app_owner`). | `scripts/bootstrap-post.mjs` | **RESOLVIDO** |
| **H-01** | Arnés Docker no probaba el flujo de 3 fases standalone | `docker-compose.audit.yml` y suite de prueba configuradas para ejecutar exactamente la secuencia `bootstrap:pre` $\rightarrow$ `migrate:prod` $\rightarrow$ `bootstrap:post`. | `docker-compose.audit.yml` | **RESOLVIDO** |
| **H-02** | `validate_v0.3.5.cjs` simulaba manualmente `ALTER DATABASE` | Suite de validación `validate_v0.3.6.cjs` comprueba directamente la ejecución no transaccional y el fallo cerrado en fallos de cambio de propietario de BD. | `validate_v0.3.6.cjs` | **RESOLVIDO** |
| **H-03** | Puertos fijos 5432 y 6379 en `docker-compose.audit.yml` | Puertos mapeados dinámicamente con valores por defecto no en conflicto `${POSTGRES_PORT:-15432}:5432` y `${REDIS_PORT:-16379}:6379`. | `docker-compose.audit.yml` | **RESOLVIDO** |
| **H-04** | Coherencia de versión en `DEPLOYMENT_REPORT.md` | Actualización de encabezado, fechas y metadatos a `v0.3.6` en `DEPLOYMENT_REPORT.md` y comprobación en `validate_v0.3.6.cjs`. | `DEPLOYMENT_REPORT.md`, `validate_v0.3.6.cjs` | **RESOLVIDO** |
| **H-05** | Probes HTTP exigían disponibilidad | Pruebas de salud HTTP Fastify verficadas (`/healthz`, `/readyz`, `/`). | `validate_v0.3.6.cjs` | **RESOLVIDO** |

---

## 2. Firma del Dictamen

- **Autor de la Remediación:** Equipo de Ingeniería Antigravity DeepMind
- **Resultado:** **Aprobado sin Reservas — Release v0.3.6 Listo para Despliegue en Plesk**
