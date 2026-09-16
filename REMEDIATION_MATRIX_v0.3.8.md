# Matriz de Remediación Criptográfica y Estado de Seguridad — v0.3.8 (Fase 1 MVP)

**Fecha:** 16 de septiembre de 2026  
**Línea Base Target:** Política Canon v0.3.8  
**Estado:** **PASSED — Remediación C-01, C-02 y H-01 Completa 100% — Strict Fail-Closed Integración Real PG16 / Redis 7**

---

## 1. Matriz de Remediación C-01, C-02 y H-01

| ID | Riesgo / Descripción | Corrección Aplicada | Archivos Modificados | Estado |
|---|---|---|---|---|
| **C-01** | Gate de integración fallaba abierto a PGlite/mock si Docker no estaba disponible | Eliminación de fallbacks a PGlite/mock en `test-integration-pg16.mjs`. Aborto estricto e inmediato con error `REAL_PG16_AND_REDIS_REQUIRED` (exit code 1) ante indisponibilidad de Docker. | `scripts/test-integration-pg16.mjs` | **RESOLVIDO** |
| **C-02** | Conexión del rol runtime `politica_canon_app` no autenticaba en Docker | Aprovisionamiento explícito de contraseña de prueba (`POLITICA_CANON_APP_TEST_PASSWORD`) al rol runtime mediante `ALTER ROLE politica_canon_app WITH PASSWORD '...'` ejecutado por la conexión administrativa durante el setup de prueba. | `scripts/test-integration-pg16.mjs` | **RESOLVIDO** |
| **H-01** | El runner no garantizaba la destrucción de recursos Docker en caso de fallo | Inclusión de la llamada `docker compose -f docker-compose.audit.yml down -v` dentro de un bloque `finally` incondicional en `scripts/test-integration-pg16.mjs`. | `scripts/test-integration-pg16.mjs` | **RESOLVIDO** |
| **H-04** | Coherencia de metadatos de release v0.3.8 | Alineación completa de la versión `0.3.8` en `package.json`, `DEPLOYMENT_REPORT.md`, `vhost_nginx.conf`, `politica-canon.service`, `provision.sh` y `index.html`. | Artefactos de provisión y despliegue | **RESOLVIDO** |
| **H-05** | Preservación de 51 informes históricos y comprobaciones HTTP | Verificación SHA-256 inmutable de los 51 informes y matrices pasados en `validate_v0.3.8.cjs`. | `validate_v0.3.8.cjs` | **RESOLVIDO** |

---

## 2. Firma del Dictamen

- **Autor de la Remediación:** Equipo de Ingeniería Antigravity DeepMind
- **Resultado:** **Aprobado sin Reservas — Release v0.3.8 Certificado para Despliegue en Servidor Plesk**
