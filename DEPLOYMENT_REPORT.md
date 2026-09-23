# Despliegue controlado — v0.4.0-alpha.6

## Gate previo

No desplegar si cualquiera de estos comandos falla:

```bash
npm ci
npm run typecheck
npm run build
npm run test:security
npm test
```

La ausencia de Docker invalida el PASS integral de `npm test`; no debe sustituirse por mocks ni por PGlite.

## Instalación en Plesk / Ubuntu 24.04

```bash
cd /opt/politica-canon/app
sudo bash deploy/scripts/provision.sh

# Revisar/configurar SMTP y secretos antes de continuar.
sudoedit /etc/politica-canon/runtime.env

# Ejecuta backup, 3 fases de DB, preflight, activación y probes.
sudo bash deploy/scripts/activate-release.sh
```

`provision.sh` deja deliberadamente ambos servicios deshabilitados e inactivos. Solo `activate-release.sh` puede habilitarlos tras un preflight completo.

## Verificación pública

```bash
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://127.0.0.1:3000/readyz
curl -sI https://peaceful-johnson.194-164-175-146.plesk.page/
```

Resultados requeridos: 200, 200 y 401 sin credenciales HTTP Basic, respectivamente.

## Rollback

El script imprime la ruta exacta del dump creado. Ante fallo:

```bash
sudo systemctl stop politica-canon politica-canon-outbox-worker
sudo -u postgres pg_restore --clean --if-exists --dbname=politica_canon /root/politica-canon/backups/<dump>.dump
```

El rollback de base de datos es destructivo y requiere una ventana aprobada y cotejo explícito del dump.
