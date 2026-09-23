# Informe de validación — v0.4.0-alpha.5

**Fecha:** 2026-09-22  
**Estado:** **PASS LOCAL / GATE REAL PENDIENTE**

## Resultados observados

| Control | Resultado |
|---|---|
| `npm ci` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilidades |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npx --no-install oxlint src scripts` | PASS — 0 advertencias tras remediación |
| `npm run test:security` | PASS |
| `node validate_v0.4.0-alpha.5.cjs` | PASS — 11/11 |
| `bash -n` scripts de despliegue | PASS |
| Instalación `npm ci --omit=dev` aislada | PASS — `pg`, Fastify, Redis y Nodemailer resolubles |
| `npm test` completo | **NO EJECUTABLE EN ESTE HOST** — Docker no está instalado; falla cerrado con `REAL_PG16_AND_REDIS_REQUIRED` |

## Regresiones ejecutables añadidas

- AES-GCM válido descifra correctamente.
- Envelope malformado falla con `PAYLOAD_DECRYPTION_FAILED`.
- Clave AES-GCM incorrecta falla con `PAYLOAD_DECRYPTION_FAILED`.
- El worker no invoca SMTP cuando el payload no puede descifrarse y devuelve el mensaje a `PENDING`.
- `ADMIN` no puede delegar `ADMIN`; `COORDINATOR` no puede delegar `COORDINATOR`.
- El frontend no contiene el sink de perfil `container.innerHTML`, usa `/api/v1/auth/me` y no publica roles `user/admin` inválidos.

## Gate de promoción

No crear tag, GitHub Release ni desplegar hasta obtener código 0 de `npm test` en un clon limpio con Docker real. Después debe verificarse la identidad del árbol Git con el artefacto empaquetado y ejecutar el preflight productivo antes de activar systemd.
