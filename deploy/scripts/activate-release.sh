#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/politica-canon/app"
ENV_FILE="/etc/politica-canon/runtime.env"
BACKUP_DIR="/root/politica-canon/backups"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: activate-release.sh debe ejecutarse como root." >&2
  exit 1
fi

cd "${APP_DIR}"
test -r "${ENV_FILE}" || { echo "ERROR: falta ${ENV_FILE}" >&2; exit 1; }

cleanup_on_error() {
  status=$?
  if [ "${status}" -ne 0 ]; then
    systemctl stop politica-canon.service politica-canon-outbox-worker.service >/dev/null 2>&1 || true
    echo "ERROR: activación abortada; servicios detenidos. La copia de seguridad se conserva." >&2
  fi
  exit "${status}"
}
trap cleanup_on_error EXIT

systemctl stop politica-canon.service politica-canon-outbox-worker.service >/dev/null 2>&1 || true
mkdir -p "${BACKUP_DIR}"
chmod 0700 "${BACKUP_DIR}"
backup="${BACKUP_DIR}/pre-v0.4.0-alpha.5-$(date +%Y%m%d_%H%M%S).dump"
sudo -u postgres pg_dump --format=custom politica_canon > "${backup}"
chmod 0600 "${backup}"
sha256sum "${backup}" > "${backup}.sha256"

sudo -u postgres npm run bootstrap:pre
sudo -u postgres env MIGRATION_DATABASE_URL="postgresql:///politica_canon?host=/var/run/postgresql" npm run migrate:prod
sudo -u postgres npm run bootstrap:post

set -a
# shellcheck disable=SC1090
. "${ENV_FILE}"
set +a
runuser -u politica-canon --preserve-environment -- npm run preflight:prod

cp deploy/systemd/politica-canon.service /etc/systemd/system/
cp deploy/systemd/politica-canon-outbox-worker.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now politica-canon.service politica-canon-outbox-worker.service

systemctl is-active --quiet politica-canon.service
systemctl is-active --quiet politica-canon-outbox-worker.service
curl --fail --silent --show-error http://127.0.0.1:3000/healthz >/dev/null
curl --fail --silent --show-error http://127.0.0.1:3000/readyz >/dev/null

trap - EXIT
echo "RELEASE_ACTIVATION_PASS backup=${backup}"
