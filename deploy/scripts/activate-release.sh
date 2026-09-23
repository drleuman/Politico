#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/politica-canon/app"
ENV_FILE="/etc/politica-canon/runtime.env"
BACKUP_DIR="/root/politica-canon/backups"
ROLLBACK_DIR="/opt/politica-canon/rollback"
RELEASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: activate-release.sh debe ejecutarse como root." >&2
  exit 1
fi

test -r "${ENV_FILE}" || { echo "ERROR: falta ${ENV_FILE}" >&2; exit 1; }
test -r "${RELEASE_DIR}/package.json" || { echo "ERROR: release incompleto: ${RELEASE_DIR}" >&2; exit 1; }

web_was_active=0
worker_was_active=0
systemctl is-active --quiet politica-canon.service && web_was_active=1 || true
systemctl is-active --quiet politica-canon-outbox-worker.service && worker_was_active=1 || true

switched=0
previous_target=""
previous_backup=""
unit_backup_dir=""

cleanup_on_error() {
  status=$?
  if [ "${status}" -ne 0 ]; then
    systemctl stop politica-canon.service politica-canon-outbox-worker.service >/dev/null 2>&1 || true
    if [ "${switched}" -eq 1 ]; then
      if [ -L "${APP_DIR}" ] && [ "$(readlink -f "${APP_DIR}")" = "${RELEASE_DIR}" ]; then
        unlink "${APP_DIR}"
      fi
      if [ -n "${previous_target}" ]; then
        ln -s "${previous_target}" "${APP_DIR}"
      elif [ -n "${previous_backup}" ] && [ -d "${previous_backup}" ]; then
        mv "${previous_backup}" "${APP_DIR}"
      fi
      if [ -n "${unit_backup_dir}" ] && [ -d "${unit_backup_dir}" ]; then
        cp "${unit_backup_dir}/politica-canon.service" /etc/systemd/system/ 2>/dev/null || true
        cp "${unit_backup_dir}/politica-canon-outbox-worker.service" /etc/systemd/system/ 2>/dev/null || true
        systemctl daemon-reload
      fi
      if [ "${web_was_active}" -eq 1 ]; then systemctl start politica-canon.service; fi
      if [ "${worker_was_active}" -eq 1 ]; then systemctl start politica-canon-outbox-worker.service; fi
    fi
    echo "ERROR: activación abortada; árbol anterior restaurado y copia de base conservada." >&2
  fi
  exit "${status}"
}
trap cleanup_on_error EXIT

systemctl stop politica-canon.service politica-canon-outbox-worker.service >/dev/null 2>&1 || true
mkdir -p "${ROLLBACK_DIR}"
if [ -e "${APP_DIR}" ] || [ -L "${APP_DIR}" ]; then
  current_target="$(readlink -f "${APP_DIR}")"
  if [ "${current_target}" != "${RELEASE_DIR}" ]; then
    if [ -L "${APP_DIR}" ]; then
      previous_target="${current_target}"
      unlink "${APP_DIR}"
    else
      previous_backup="${ROLLBACK_DIR}/app-pre-v0.4.0-alpha.6-$(date +%Y%m%d_%H%M%S)"
      mv "${APP_DIR}" "${previous_backup}"
    fi
    ln -s "${RELEASE_DIR}" "${APP_DIR}"
    switched=1
  fi
else
  ln -s "${RELEASE_DIR}" "${APP_DIR}"
  switched=1
fi

cd "${APP_DIR}"
mkdir -p "${BACKUP_DIR}"
chmod 0700 "${BACKUP_DIR}"
backup="${BACKUP_DIR}/pre-v0.4.0-alpha.6-$(date +%Y%m%d_%H%M%S).dump"
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

unit_backup_dir="${ROLLBACK_DIR}/systemd-pre-v0.4.0-alpha.6-$(date +%Y%m%d_%H%M%S)"
mkdir -p "${unit_backup_dir}"
cp /etc/systemd/system/politica-canon.service "${unit_backup_dir}/" 2>/dev/null || true
cp /etc/systemd/system/politica-canon-outbox-worker.service "${unit_backup_dir}/" 2>/dev/null || true
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
