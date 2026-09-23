# Política Canon v0.4.0-alpha.5

Monolito institucional de gobernanza con Fastify, PostgreSQL 16, Redis 7 y un worker SMTP desacoplado. Esta versión corrige los bloqueadores descubiertos en la auditoría independiente de `v0.4.0-alpha.4` y continúa el frontend de identidad, sesiones, invitaciones y usuarios.

## Requisitos

- Node.js 22+
- PostgreSQL 16+
- Redis 7+
- SMTP con TLS y remitente válido
- Docker Compose para la suite de integración real

## Desarrollo y verificación

```bash
npm ci
npm run typecheck
npm run build
npm run test:security
npm test
```

`npm test` es fail-closed: exige Docker y levanta PostgreSQL 16, Redis 7 y Mailpit reales. Si Docker no está disponible, el comando falla y el release no puede recibir un PASS integral.

## Secuencia canónica de base de datos

```bash
sudo -u postgres npm run bootstrap:pre
sudo -u postgres env MIGRATION_DATABASE_URL="postgresql:///politica_canon?host=/var/run/postgresql" npm run migrate:prod
sudo -u postgres npm run bootstrap:post
```

Los tres comandos están declarados en `package.json`. No se usa Drizzle ni `npx` para producción.

## Despliegue controlado

1. Extraer el release en `/opt/politica-canon/app`.
2. Ejecutar `deploy/scripts/provision.sh`; instala configuración y unidades, pero no las habilita ni inicia.
3. Configurar SMTP y secretos en `/etc/politica-canon/runtime.env`.
4. Ejecutar `deploy/scripts/activate-release.sh` como `root`.

La activación crea una copia de seguridad, ejecuta las tres fases de base de datos, verifica checksums de migración, propietarios, FORCE RLS, roles runtime/worker, Redis y SMTP. Solo entonces habilita los servicios y exige `/healthz` y `/readyz` con HTTP 200.

## Seguridad relevante

- Tokens de outbox cifrados con AES-256-GCM; cualquier error de formato, autenticación o clave falla cerrado.
- Roles delegables: `ADMIN` puede delegar `COORDINATOR`, `WRITER` y `REVIEWER`; `COORDINATOR` solo `WRITER` y `REVIEWER`.
- No se permite crear `ADMIN`, `APPROVER`, `PUBLISHER` ni `AUDITOR` mediante invitación directa.
- El frontend representa datos de usuario mediante `textContent` y nodos DOM, sin interpolación HTML.
- PostgreSQL, Redis y Fastify permanecen vinculados a loopback en producción.

## Archivos principales

- `src/server.ts`: servidor y sondas.
- `src/auth/`: sesiones, invitaciones, MFA y autorización.
- `src/email/`: adaptador SMTP, outbox y cifrado de payloads.
- `db/migrations/`: migraciones incrementales verificadas por SHA-256.
- `deploy/`: unidades systemd y scripts de provisión/activación.
- `scripts/test-security-regressions.mjs`: regresiones críticas independientes de Docker.
- `scripts/test-integration-pg16.mjs`: integración real.
