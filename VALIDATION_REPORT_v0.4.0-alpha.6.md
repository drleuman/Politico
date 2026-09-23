# Informe de validación — v0.4.0-alpha.6

**Fecha:** 2026-09-23
**Estado:** **PASS — GATE REAL CERTIFICADO EN GITHUB ACTIONS**

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
| `npm test` completo | PASS en GitHub Actions, Ubuntu 24.04 / Node.js 22 / Docker real |
| PostgreSQL 16 + Redis 7 + Mailpit | PASS — integración real y gate fail-closed completo |
| Workflow certificado | PASS — ejecución `35865843433`, job `107197074972` |

## Regresiones ejecutables añadidas

- AES-GCM válido descifra correctamente.
- Envelope malformado falla con `PAYLOAD_DECRYPTION_FAILED`.
- Clave AES-GCM incorrecta falla con `PAYLOAD_DECRYPTION_FAILED`.
- El worker no invoca SMTP cuando el payload no puede descifrarse y devuelve el mensaje a `PENDING`.
- `ADMIN` no puede delegar `ADMIN`; `COORDINATOR` no puede delegar `COORDINATOR`.
- El frontend no contiene el sink de perfil `container.innerHTML`, usa `/api/v1/auth/me` y no publica roles `user/admin` inválidos.
- Los hashes de las migraciones aplicadas `0001`, `0003`, `0004` y `0005` coinciden exactamente con producción.
- Git conserva sin normalización los bytes CRLF históricos de `0003` y `0004`.

## Evidencia del gate de promoción

El workflow [v0.4.0-alpha.6 integration gate](https://github.com/drleuman/Politico/actions/runs/35865843433) ejecutó `npm ci` y `npm test` sobre el commit `8d3e30eb050ca8378d2a59eab54a1f958143c70b`. El job `107197074972` finalizó con código 0 y acreditó PostgreSQL 16, Redis 7, Mailpit, compilación, regresiones de seguridad y los 12 controles del validador.
