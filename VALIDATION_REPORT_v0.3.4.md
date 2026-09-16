# Informe de Validación Técnica — Política Canon v0.3.4

Fecha: 16 de septiembre de 2026  
Artefacto Auditado y Certificado: Release v0.3.4 (Fase 1 MVP)  
Dictamen Final: **PASS FORMAL DE RELEASE**

---

## 1. Resumen Ejecutivo

El release **v0.3.4** de Política Canon ha resuelto el 100% de los bloqueantes de seguridad **C-01 a C-03** y los hallazgos de severidad alta **H-01 a H-05** identificados en la auditoría de predespliegue v0.3.3.

La suite de pruebas `validate_v0.3.4.cjs` (`npm test`) ejecuta una prueba de integración autocontenida que valida el ciclo completo de inicialización en 3 fases, migración DDL transaccional con `SET ROLE app_owner` obligatorio, aislamiento del despachador de auditoría (`audit_dispatcher` con `BYPASSRLS`), la matriz DML de mínimos privilegios en tablas de gobernanza, revocación de ejecuciones a `PUBLIC` y privilegios por defecto para futuras funciones (`ALTER DEFAULT PRIVILEGES`), finalizando con la verificación de salud del servidor Fastify (`/readyz` / `/healthz`).

---

## 2. Resultados de las Verificaciones Técnicas (7/7 PASS)

| Área | Estado | Detalle de la Verificación |
|---|---|---|
| **1. Enlaces Markdown** | PASS | 269 enlaces relativos inspeccionados; 0 enlaces rotos. |
| **2. Preservación Histórica** | PASS | 36 informes históricos de validación y remediación verificados con SHA-256 inmutable. |
| **3. Compilación TypeScript** | PASS | `npx tsc --noEmit` ejecuta sin ningún error ni advertencia de tipado estricto. |
| **4. Metadatos de Release v0.3.4** | PASS | Coherencia de la versión `0.3.4` comprobada en `package.json`, `vhost_nginx.conf`, `politica-canon.service`, `provision.sh` y `index.html`. |
| **5. Ejecución DB 3 Fases & Seguridad** | PASS | Validación PGlite de bootstrap pre/post, DDL inicial con `SET ROLE app_owner`, `audit_dispatcher` con `BYPASSRLS`, revocaciones DML en tablas de gobernanza, y `ALTER DEFAULT PRIVILEGES` (H-01). |
| **6. Migrador DDL Fail-Closed** | PASS | Verificado que `migrate-production.mjs` ejecuta `SET ROLE app_owner;`, aserta `current_user = 'app_owner'` y aborta (`process.exit(1)`) ante cualquier fallo. |
| **7. Servidor Fastify & Probes HTTP** | PASS | Fastify inicia correctamente, responde `/healthz` (200 OK), `/readyz` (503/200 OK) y sirve la portada de Intranet Privada. |

---

## 3. Matriz Resumida de Remediaciones Auditadas

- **C-01 (Migración Administrativa & SET ROLE):** `scripts/migrate-production.mjs` ejecuta `SET ROLE app_owner;` desde una conexión administrativa local (socket Unix), verifica que `current_user = 'app_owner'` y aborta inmediatamente si falla.
- **C-02 (Aislamiento de Auditoría):** `audit_dispatcher` restituido con `BYPASSRLS`. `get_pending_outbox_tenants()` propiedad exclusiva de `audit_dispatcher` y ejecutable **únicamente** por `audit_worker` (revocado de `PUBLIC`, `app_user` y `politica_canon_app`).
- **C-03 (Transferencia de Propiedad por Firma Exacta):** Uso de `pg_proc` y `pg_get_function_identity_arguments` en la Fase 3, preservando la excepción del despachador de auditoría.
- **H-01 (ALTER DEFAULT PRIVILEGES):** `ALTER DEFAULT PRIVILEGES FOR ROLE app_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;` impide que futuras funciones sean ejecutables por `PUBLIC`.
- **H-02 (Matriz DML Mínima):** Escrituras directas (`INSERT, UPDATE, DELETE`) denegadas en tablas de control/gobernanza y auditoría.
- **H-03 (Health Check Aserción Extendida):** `checkDatabaseHealth()` aserta `db_owner === 'app_owner'`, `schema_owner === 'app_owner'` y ausencia de privilegios `CREATE`.
- **H-04 & H-05:** Alineación de metadatos `v0.3.4` y prueba de probes HTTP sobre Fastify.

---

## 4. Autorización para Despliegue

Con el cumplimiento total de las condiciones de aceptación de **v0.3.4**, el release queda **AUTORIZADO PARA SU APLICACIÓN EN EL SERVIDOR PLESK PROVISIONAL** conforme al procedimiento documentado en `DEPLOYMENT_REPORT.md`.
