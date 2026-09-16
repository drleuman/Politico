# Matriz de Remediación Técnica — Release v0.3.17 (Fase 1.1 Correctiva)

Este documento registra la remediación y emisión del release **v0.3.17**, incorporando la inmutabilidad estricta del paquete tras la normalización CRLF multiplataforma en la validación estática de informes históricos.

> [!IMPORTANT]
> **REMEDIADO LOCALMENTE — NO DESPLEGAR A PRODUCCIÓN**  
> El servidor productivo y el entorno de Plesk permanecen congelados en **v0.3.11** hasta recibir la ratificación y aprobación humana.

---

## Matriz de Remediaciones

| ID | Severidad | Componente / Archivo | Descripción del Hallazgo Auditado | Remediación Implementada y Verificada en v0.3.17 |
|---|---|---|---|---|
| **SEC-19** | **Medio** | [`validate_v0.3.17.cjs`](validate_v0.3.17.cjs) | El cálculo de hashes SHA-256 sobre informes históricos markdown fallaba en entornos Windows si Git convertía saltos de línea a CRLF (`\r\n`). | Se incorporó la transformación `.replace(/\r\n/g, '\n')` en `validate_v0.3.17.cjs` antes del cálculo SHA-256, haciendo la verificación de firmas idéntica en Windows (CRLF) y Linux (LF). |
| **SEC-20** | **Crítico** | [`package.json`](package.json)<br>[`CHANGELOG.md`](CHANGELOG.md) | Cualquier modificación de código o validador post-auditoría altera el hash del ZIP, requiriendo un nuevo número de release inmutable. | Se incrementó la versión a `v0.3.17` en metadatos, manifiesto, scripts, informes y changelog para preservar la inmutabilidad criptográfica. |

---

## Comprobación de Scripts Canónicos de Despliegue

1. `npm run bootstrap:pre` $\rightarrow$ Ejecuta `node scripts/bootstrap-pre.mjs`
2. `npm run migrate:prod` $\rightarrow$ Ejecuta `node scripts/migrate-production.mjs`
3. `npm run bootstrap:post` $\rightarrow$ Ejecuta `node scripts/bootstrap-post.mjs`
