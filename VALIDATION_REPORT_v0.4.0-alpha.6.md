# Informe de validación — v0.4.0-alpha.6

**Fecha:** 2026-09-23
**Estado:** **EN VALIDACIÓN — NUEVO GATE REQUERIDO**

## Resultados observados

| Control | Resultado |
|---|---|
| `npm ci` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilidades |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npx --no-install oxlint src scripts` | PASS — 0 advertencias tras remediación |
| `npm run test:security` | PASS |
| `node validate_v0.4.0-alpha.6.cjs` | PASS — 12/12 |
| `bash -n` scripts de despliegue | PASS |
| Instalación `npm ci --omit=dev` aislada | PASS — `pg`, Fastify, Redis y Nodemailer resolubles |
| `npm test` completo | Pendiente de un workflow nuevo sobre el árbol `alpha.6` |
| PostgreSQL 16 + Redis 7 + Mailpit | Pendiente de un workflow nuevo |
| Workflow certificado | Pendiente |

## Regresiones ejecutables añadidas

- AES-GCM válido descifra correctamente.
- Envelope malformado falla con `PAYLOAD_DECRYPTION_FAILED`.
- Clave AES-GCM incorrecta falla con `PAYLOAD_DECRYPTION_FAILED`.
- El worker no invoca SMTP cuando el payload no puede descifrarse y devuelve el mensaje a `PENDING`.
- `ADMIN` no puede delegar `ADMIN`; `COORDINATOR` no puede delegar `COORDINATOR`.
- El frontend no contiene el sink de perfil `container.innerHTML`, usa `/api/v1/auth/me` y no publica roles `user/admin` inválidos.
- Los hashes de las migraciones aplicadas `0001`, `0003`, `0004` y `0005` coinciden exactamente con producción.
- Git conserva sin normalización los bytes CRLF históricos de `0003` y `0004`.

## Gate de promoción

Debe ejecutarse un workflow nuevo sobre el commit final de `alpha.6`. La evidencia de `alpha.5` no se reutiliza porque el árbol y el activador han cambiado.
