# Informe de validación — v0.4.0-alpha.5

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
| `node validate_v0.4.0-alpha.5.cjs` | PASS — 11/11 |
| `bash -n` scripts de despliegue | PASS |
| Instalación `npm ci --omit=dev` aislada | PASS — `pg`, Fastify, Redis y Nodemailer resolubles |
| `npm test` completo | PASS en GitHub Actions, Ubuntu 24.04 / Node.js 22 / Docker real |
| PostgreSQL 16 + Redis 7 + Mailpit | PASS — integración real, E2E y limpieza `down -v` |
| Workflow certificado | PASS — ejecución `35808205424`, job `107013617111` |

## Regresiones ejecutables añadidas

- AES-GCM válido descifra correctamente.
- Envelope malformado falla con `PAYLOAD_DECRYPTION_FAILED`.
- Clave AES-GCM incorrecta falla con `PAYLOAD_DECRYPTION_FAILED`.
- El worker no invoca SMTP cuando el payload no puede descifrarse y devuelve el mensaje a `PENDING`.
- `ADMIN` no puede delegar `ADMIN`; `COORDINATOR` no puede delegar `COORDINATOR`.
- El frontend no contiene el sink de perfil `container.innerHTML`, usa `/api/v1/auth/me` y no publica roles `user/admin` inválidos.

## Evidencia del gate de promoción

El workflow [v0.4.0-alpha.5 integration gate](https://github.com/drleuman/Politico/actions/runs/35808205424) ejecutó `npm ci` y `npm test` sobre el árbol Git `64a70ac27247e55823d35f6f9ee077b6489687db`. Finalizó con código 0 y verificó:

- PostgreSQL 16, Redis 7 y Mailpit reales mediante Docker Compose.
- Integración E2E de sesiones, reset de contraseña, outbox cifrado, aislamiento multitenant, MFA y matriz RBAC.
- Validador independiente 11/11 PASS.
- Limpieza incondicional de contenedores, redes y volúmenes mediante `finally` y `down -v`.

La promoción permanece sujeta a identidad exacta entre el árbol final del candidato y el artefacto empaquetado, revisión del Pull Request y preflight productivo antes de activar systemd.
