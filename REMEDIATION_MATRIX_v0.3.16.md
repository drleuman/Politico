# Matriz de Remediación Técnica — Release v0.3.16 (Fase 1.1 Correctiva)

Este documento registra la remediación de los hallazgos de auditoría identificados en la versión **v0.3.15**, corrigiendo la desalineación de los comandos de despliegue en `package.json` y asegurando la sincronización total con `DEPLOYMENT_REPORT.md`.

> [!IMPORTANT]
> **REMEDIADO LOCALMENTE — NO DESPLEGAR A PRODUCCIÓN**  
> El servidor productivo y el entorno de Plesk permanecen congelados en **v0.3.11** hasta recibir la revisión y aprobación humana.

---

## Matriz de Remediaciones

| ID | Severidad | Componente / Archivo | Descripción del Hallazgo Auditado | Remediación Implementada y Verificada en v0.3.16 |
|---|---|---|---|---|
| **SEC-16** | **Crítico** | [`package.json`](package.json) | `package.json` definía `db:bootstrap` y `db:migrate` hacia archivos inexistentes (`MODULE_NOT_FOUND`). Los comandos de `DEPLOYMENT_REPORT.md` (`bootstrap:pre`, `migrate:prod`, `bootstrap:post`) no estaban declarados. | Se eliminaron los comandos obsoletos `db:bootstrap` / `db:migrate` y se declararon formalmente `bootstrap:pre`, `migrate:prod` y `bootstrap:post` apuntando a los archivos `.mjs` reales en `scripts/`. |
| **SEC-17** | **Medio** | [`scripts/test-integration-pg16.mjs`](scripts/test-integration-pg16.mjs) | El runner de integración anunciaba versión v0.3.14 en sus impresiones de consola. | Se actualizaron todas las cadenas y banners del runner a la versión `v0.3.16`. |
| **SEC-18** | **Medio** | [`validate_v0.3.16.cjs`](validate_v0.3.16.cjs) | El validador estático no comprobaba que los comandos de producción documentados existieran en `package.json` ni que sus archivos de destino fueran ejecutables en disco. | Se incorporó una comprobación en el validador estático que parsea `package.json`, valida la existencia de las claves `bootstrap:pre`, `migrate:prod` y `bootstrap:post` y confirma la existencia física de sus archivos fuente. |

---

## Comprobación de Scripts de Despliegue Canónicos

Se verificó la ejecución directa de los tres comandos declarados en `package.json`:

1. `npm run bootstrap:pre` -> Ejecuta `node scripts/bootstrap-pre.mjs`
2. `npm run migrate:prod` -> Ejecuta `node scripts/migrate-production.mjs`
3. `npm run bootstrap:post` -> Ejecuta `node scripts/bootstrap-post.mjs`
