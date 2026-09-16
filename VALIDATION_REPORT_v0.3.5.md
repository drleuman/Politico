# Informe de Validación Técnica — Política Canon v0.3.5

Fecha: 16 de septiembre de 2026  
Artefacto Auditado y Certificado: Release v0.3.5 (Fase 1 MVP)  
Dictamen Final: **PASS FORMAL DE RELEASE**

---

## 1. Resumen Ejecutivo

El release **v0.3.5** de Política Canon ha resuelto el 100% de los bloqueantes de seguridad **C-01** y los hallazgos de severidad alta **H-01 a H-04** identificados en la auditoría de predespliegue v0.3.4.

La suite de pruebas `validate_v0.3.5.cjs` (`npm test`) ejecuta una prueba de integración autocontenida que valida la ejecución standalone fuera de transacción de `ALTER DATABASE politica_canon OWNER TO app_owner;`, la inicialización en 3 fases idempotentes, la preservación criptográfica inmutable de los **45 informes y matrices históricos**, el aislamiento de `audit_dispatcher` (BYPASSRLS), y las verificaciones HTTP de salud del servidor Fastify (`/healthz`, `/readyz`).

---

## 2. Resultados de las Verificaciones Técnicas (7/7 PASS)

| Área | Estado | Detalle de la Verificación |
|---|---|---|
| **1. Enlaces Markdown** | PASS | 269 enlaces relativos inspeccionados; 0 enlaces rotos. |
| **2. Preservación Histórica (H-03)** | PASS | 45 informes históricos de validación y remediación verificados con SHA-256 inmutable. |
| **3. Compilación TypeScript** | PASS | `npx tsc --noEmit` ejecuta sin ningún error ni advertencia de tipado estricto. |
| **4. Metadatos de Release v0.3.5 (H-04)** | PASS | Coherencia de la versión `0.3.5` comprobada en `package.json`, `vhost_nginx.conf`, `politica-canon.service`, `provision.sh` y `index.html`. |
| **5. Ejecución DB 3 Fases & Seguridad** | PASS | Validación PGlite de bootstrap pre/post, DDL inicial con `SET ROLE app_owner`, `audit_dispatcher` con `BYPASSRLS`, revocaciones DML en tablas de gobernanza, y `ALTER DEFAULT PRIVILEGES`. |
| **6. Migrador DDL & Standalone ALTER DATABASE (C-01)** | PASS | Verificado que `migrate-production.mjs` exige `SET ROLE app_owner;` y que `bootstrap-post.mjs` ejecuta `ALTER DATABASE` fuera de bloques de transacción `BEGIN...COMMIT`. |
| **7. Servidor Fastify & Probes HTTP** | PASS | Fastify inicia correctamente, responde `/healthz` (200 OK), `/readyz` (503/200 OK) y sirve la portada de Intranet Privada. |

---

## 3. Matriz Resumida de Remediaciones Auditadas

- **C-01 (ALTER DATABASE Fuera de Transacción):** `scripts/bootstrap-post.mjs` ejecuta `ALTER DATABASE politica_canon OWNER TO app_owner;` de forma standalone fuera de transacciones `BEGIN...COMMIT` y sin bloques `DO $$`, evitando errores en PostgreSQL 16 real.
- **H-01 & H-02 (Docker Audit 3 Fases):** [`docker-compose.audit.yml`](docker-compose.audit.yml) actualizado para montar las 3 fases canónicas en `/docker-entrypoint-initdb.d/`.
- **H-03 (Preservación Inmutable de 45 Informes):** Registrados y verificados los 45 hashes SHA-256 de todos los informes y matrices históricos en `validate_v0.3.5.cjs`.
- **H-04 (Coherencia Metadatos v0.3.5):** Alineación completa de versión `v0.3.5` en artefactos de despliegue y portada Web.

---

## 4. Autorización para Despliegue

Con el cumplimiento total de las condiciones de aceptación de **v0.3.5**, el release queda **AUTORIZADO PARA SU APLICACIÓN EN EL SERVIDOR PLESK PROVISIONAL** conforme al procedimiento documentado en `DEPLOYMENT_REPORT.md`.
