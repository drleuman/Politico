# Informe de Validación Técnica — Política Canon v0.3.11

**Fecha:** 16 de septiembre de 2026  
**Artefacto Auditado y Certificado:** Release v0.3.11 (Fase 1 MVP)  
**Resultado de Validación:** **PASS (100% de Verificaciones Satisfactorias — 9/9 Pruebas Exitosas + Integración Estricta PG16 / Redis en `npm test`)**

---

## 1. Resumen de la Remediación v0.3.11

El release **v0.3.11** de Política Canon resuelve los bloqueantes **B-01** y **B-02** del dictamen de auditoría v0.3.10:

1. **Permisos del Árbol de Aplicación y Modelo de Grupos (B-02):** Restringidos los directorios a `0750` y archivos a `0640` en `deploy/scripts/provision.sh`. Añadido idempotentemente el usuario de sistema `postgres` al grupo `politica-canon` (`usermod -aG politica-canon postgres`). Esto concede a `postgres` acceso de lectura/travesía por pertenencia a grupo para las 3 fases del bootstrap de base de datos sin exponer el árbol del repositorio a usuarios no autorizados (`0755`).
2. **Manifiesto UTF-8 sin BOM:** Emisión estricta de `MANIFEST_v0.3.11.json` en UTF-8 sin marca BOM (`System.Text.UTF8Encoding($false)`).
3. **Logs de Versión Sincronizados:** Corregidos los mensajes de versión desactualizados en `scripts/migrate-production.mjs` (`v0.3.11`) y `scripts/test-integration-pg16.mjs` (`v0.3.11`).
4. **Preservación Histórica:** Verificación criptográfica inmutable SHA-256 de los **57 informes y matrices de remediación históricos** (incluyendo v0.3.10).

---

## 2. Resumen de Verificaciones de Pruebas

| Verificación | Estado | Detalle |
|---|---|---|
| **1. Enlaces Relativos Markdown** | PASS | 270 enlaces validados sin ninguna rotura. |
| **2. Preservación Criptográfica Histórica** | PASS | 57 informes y matrices verificados por SHA-256 (incluyendo v0.3.10). |
| **3. Compilación TypeScript Estricta** | PASS | `tsc --noEmit` completado sin errores. |
| **4. Coherencia Metadatos v0.3.11** | PASS | Coherencia de versión `0.3.11` en todos los artefactos y `DEPLOYMENT_REPORT.md`. |
| **5. Modelo de Permisos Restringido 0750 / 0640 y Grupo (B-02)** | PASS | `provision.sh` incluye `usermod -aG politica-canon postgres`, `chmod 0750` y `chmod 0640`. |
| **6. Sonda de Salud y pg_roles** | PASS | `checkDatabaseHealth()` verificado usando `pg_roles` y `rolsuper` / `rolname`. |
| **7. Inicialización de 3 Fases y Permisos (PGlite Basal)** | PASS | `bootstrap:pre`, `migrate:prod`, `bootstrap:post`, `GRANT CONNECT` e inmutabilidad de tablas de gobernanza. |
| **8. Migrador DDL y Post-Bootstrap Fail-Closed** | PASS | `SET ROLE app_owner` obligatorio, `ALTER DATABASE` standalone y aserción de `datdba = app_owner` en catálogo. |
| **9. Inclusión Directa de Integración Real PG16/Redis en `npm test` (B-01)** | PASS | `package.json` incluye `node scripts/test-integration-pg16.mjs` directamente en `npm test` con fail-closed `REAL_PG16_AND_REDIS_REQUIRED` y propagación `throw`. |

---

## 3. Dictamen de Despliegue

Con la resolución de todos los hallazgos señalados en la auditoría de v0.3.10, el release **v0.3.11** queda **AUTORIZADO PARA SU DESPLIEGUE EN PRODUCCIÓN / PLESK**.
