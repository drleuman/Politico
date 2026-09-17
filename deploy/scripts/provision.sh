#!/usr/bin/env bash
# Script de Provisión Inicial de Servidor — Política Canon v0.3.27
# Ejecutar en el servidor Ubuntu 24.04 / Plesk como root o con sudo

set -euo pipefail

echo "== [POLÍTICA CANON v0.3.27] Provisión Inicial de Servidor =="

# 1. Crear usuario del sistema sin shell interactiva y asociar pertenencia de grupo postgres (B-02)
if ! id -u politica-canon >/dev/null 2>&1; then
    echo "[+] Creando usuario de sistema 'politica-canon'..."
    useradd -r -s /bin/false politica-canon
fi

if id -u postgres >/dev/null 2>&1; then
    echo "[+] Añadiendo usuario de sistema 'postgres' al grupo 'politica-canon'..."
    usermod -aG politica-canon postgres
fi

# 2. Crear directorios de la aplicación, caché y configuración
mkdir -p /opt/politica-canon/app
mkdir -p /opt/politica-canon/.npm-cache
mkdir -p /etc/politica-canon
mkdir -p /var/log/politica-canon
mkdir -p /root/politica-canon/backups

# 3. Establecer permisos reproducibles por Modelo de Grupo Restringido (B-02: 0750 / 0640)
chown -R politica-canon:politica-canon /opt/politica-canon
chmod 0750 /opt/politica-canon
chmod 0750 /opt/politica-canon/app
find /opt/politica-canon/app -type d -exec chmod 0750 {} + 2>/dev/null || true
find /opt/politica-canon/app -type f -exec chmod 0640 {} + 2>/dev/null || true
chmod 0750 /opt/politica-canon/.npm-cache
chown -R politica-canon:politica-canon /var/log/politica-canon
chmod 0750 /var/log/politica-canon
chmod 0700 /root/politica-canon/backups

# 4. Derivar DATABASE_URL desde POLITICA_CANON_DATABASE_URL, DATABASE_URL o POLITICA_CANON_DB_PASS
DERIVED_DB_URL=""
if [ -f /root/politica-canon/runtime.env ]; then
    DERIVED_DB_URL=$(grep -E '^POLITICA_CANON_DATABASE_URL=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
    if [ -z "${DERIVED_DB_URL}" ]; then
        DERIVED_DB_URL=$(grep -E '^DATABASE_URL=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
    fi
    if [ -z "${DERIVED_DB_URL}" ]; then
        DB_PASS=$(grep -E '^POLITICA_CANON_DB_PASS=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
        if [ -n "${DB_PASS}" ]; then
            DERIVED_DB_URL="postgresql://politica_canon_app:${DB_PASS}@127.0.0.1:5432/politica_canon"
        fi
    fi
fi

# Si /etc/politica-canon/runtime.env ya existe, recuperar su DATABASE_URL si no se derivó una nueva
if [ -z "${DERIVED_DB_URL}" ] && [ -f /etc/politica-canon/runtime.env ]; then
    DERIVED_DB_URL=$(grep -E '^DATABASE_URL=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
fi

# Fallar cerrado inmediatamente si no existe una URL de base de datos válida
if [ -z "${DERIVED_DB_URL}" ]; then
    echo "❌ ERROR FATAL: No se pudo determinar la URL de la base de datos desde POLITICA_CANON_DATABASE_URL, DATABASE_URL o POLITICA_CANON_DB_PASS en /root/politica-canon/runtime.env. Abortando provisión."
    exit 1
fi

# 5. Generar/Preservar secreto independiente para el worker y asignar contraseña PostgreSQL (C-01, C-02, H-03)
EXISTING_WORKER_PASS=""
if [ -f /etc/politica-canon/runtime.env ]; then
    EXISTING_WORKER_PASS=$(grep -E '^POLITICA_CANON_WORKER_DB_PASS=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
fi
if [ -z "${EXISTING_WORKER_PASS}" ] && [ -f /root/politica-canon/runtime.env ]; then
    EXISTING_WORKER_PASS=$(grep -E '^POLITICA_CANON_WORKER_DB_PASS=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
fi

if [ -n "${EXISTING_WORKER_PASS}" ]; then
    WORKER_DB_PASS="${EXISTING_WORKER_PASS}"
    echo "[+] Preservando secreto existente de politica_canon_email_worker."
else
    WORKER_DB_PASS=$(openssl rand -hex 24 || head -c 48 /dev/urandom | xxd -p | tr -d '\n')
    echo "[+] Generada nueva contraseña independiente para politica_canon_email_worker."
fi

# H-03: Exigir psql y validar formato hexadecimal seguro del secreto antes de interactuar con la BD
if ! command -v psql >/dev/null 2>&1; then
    echo "❌ ERROR FATAL: El comando psql no está disponible en PATH. Se requiere PostgreSQL client en el servidor."
    exit 1
fi

if ! [[ "${WORKER_DB_PASS}" =~ ^[a-f0-9]{32,64}$ ]]; then
    echo "❌ ERROR FATAL: WORKER_DB_PASS no cumple el formato hexadecimal requerido (32-64 caracteres a-f0-9)."
    exit 1
fi

# H-03: Asignar contraseña pasando SQL mediante stdin (sin exponer el secreto en argumentos de comando ps/argv)
echo "[+] Verificando y asignando contraseña a rol PostgreSQL 'politica_canon_email_worker'..."
su - postgres -c "psql -d politica_canon" <<SQL_EOF >/dev/null
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'politica_canon_email_worker') THEN
        CREATE ROLE politica_canon_email_worker WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 5;
    END IF;
END \$\$;
ALTER ROLE politica_canon_email_worker WITH PASSWORD '${WORKER_DB_PASS}';
SQL_EOF

echo "[+] Autenticación del worker configurada. Verificando conexión a BD..."
PGPASSWORD="${WORKER_DB_PASS}" psql -h 127.0.0.1 -U politica_canon_email_worker -d politica_canon -c "SELECT current_user;" >/dev/null
echo "[+] Conexión de 'politica_canon_email_worker' verificada exitosamente."

# Construir URL explícita del worker con su secreto independiente
DERIVED_EMAIL_WORKER_URL="postgresql://politica_canon_email_worker:${WORKER_DB_PASS}@127.0.0.1:5432/politica_canon"

# 6. Recuperar o generar SESSION_SECRET, MFA_MASTER_KEY y EMAIL_OUTBOX_ENCRYPTION_KEY (32+ bytes / 64+ hex)
EXISTING_SESSION_SECRET=""
EXISTING_MFA_KEY=""
EXISTING_OUTBOX_KEY=""
EXISTING_LEGACY_KEY=""
EXISTING_SMTP_HOST=""
EXISTING_SMTP_PORT=""
EXISTING_SMTP_USER=""
EXISTING_SMTP_PASS=""
EXISTING_SMTP_FROM=""
EXISTING_SMTP_SECURE=""

if [ -f /etc/politica-canon/runtime.env ]; then
    EXISTING_SESSION_SECRET=$(grep -E '^SESSION_SECRET=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
    EXISTING_MFA_KEY=$(grep -E '^MFA_MASTER_KEY=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
    EXISTING_OUTBOX_KEY=$(grep -E '^EMAIL_OUTBOX_ENCRYPTION_KEY=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
    EXISTING_LEGACY_KEY=$(grep -E '^EMAIL_OUTBOX_LEGACY_KEY_V0=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
    EXISTING_SMTP_HOST=$(grep -E '^SMTP_HOST=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
    EXISTING_SMTP_PORT=$(grep -E '^SMTP_PORT=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
    EXISTING_SMTP_USER=$(grep -E '^SMTP_USER=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
    EXISTING_SMTP_PASS=$(grep -E '^SMTP_PASS=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
    if [ -z "${EXISTING_SMTP_PASS}" ]; then
        EXISTING_SMTP_PASS=$(grep -E '^SMTP_PASSWORD=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
    fi
    EXISTING_SMTP_FROM=$(grep -E '^SMTP_FROM=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
    EXISTING_SMTP_SECURE=$(grep -E '^SMTP_SECURE=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
fi

# Preservar de /root/politica-canon/runtime.env si no existían en /etc
if [ -f /root/politica-canon/runtime.env ]; then
    [ -z "${EXISTING_MFA_KEY}" ] && EXISTING_MFA_KEY=$(grep -E '^MFA_MASTER_KEY=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
    [ -z "${EXISTING_OUTBOX_KEY}" ] && EXISTING_OUTBOX_KEY=$(grep -E '^EMAIL_OUTBOX_ENCRYPTION_KEY=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
    [ -z "${EXISTING_LEGACY_KEY}" ] && EXISTING_LEGACY_KEY=$(grep -E '^EMAIL_OUTBOX_LEGACY_KEY_V0=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
    [ -z "${EXISTING_SMTP_HOST}" ] && EXISTING_SMTP_HOST=$(grep -E '^SMTP_HOST=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
    [ -z "${EXISTING_SMTP_PORT}" ] && EXISTING_SMTP_PORT=$(grep -E '^SMTP_PORT=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
    [ -z "${EXISTING_SMTP_USER}" ] && EXISTING_SMTP_USER=$(grep -E '^SMTP_USER=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
    [ -z "${EXISTING_SMTP_PASS}" ] && EXISTING_SMTP_PASS=$(grep -E '^SMTP_PASS=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
    [ -z "${EXISTING_SMTP_FROM}" ] && EXISTING_SMTP_FROM=$(grep -E '^SMTP_FROM=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
    [ -z "${EXISTING_SMTP_SECURE}" ] && EXISTING_SMTP_SECURE=$(grep -E '^SMTP_SECURE=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
fi

if [ -n "${EXISTING_SESSION_SECRET}" ] && [ "${#EXISTING_SESSION_SECRET}" -ge 32 ]; then
    SESSION_SECRET="${EXISTING_SESSION_SECRET}"
    echo "[+] Preservando SESSION_SECRET existente válido."
else
    SESSION_SECRET=$(openssl rand -hex 32 || head -c 64 /dev/urandom | xxd -p | tr -d '\n')
    echo "[+] Generado nuevo SESSION_SECRET de 32 bytes (64 hex)."
fi

if [ -n "${EXISTING_MFA_KEY}" ] && [ "${#EXISTING_MFA_KEY}" -ge 32 ] && [ "${EXISTING_MFA_KEY}" != "${SESSION_SECRET}" ]; then
    MFA_MASTER_KEY="${EXISTING_MFA_KEY}"
    echo "[+] Preservando MFA_MASTER_KEY existente válida e independiente."
else
    MFA_MASTER_KEY=$(openssl rand -hex 32 || head -c 64 /dev/urandom | xxd -p | tr -d '\n')
    echo "[+] Generada nueva MFA_MASTER_KEY independiente de 32 bytes (64 hex)."
fi

if [ -n "${EXISTING_OUTBOX_KEY}" ] && [ "${#EXISTING_OUTBOX_KEY}" -ge 32 ] && [ "${EXISTING_OUTBOX_KEY}" != "${SESSION_SECRET}" ] && [ "${EXISTING_OUTBOX_KEY}" != "${MFA_MASTER_KEY}" ]; then
    EMAIL_OUTBOX_ENCRYPTION_KEY="${EXISTING_OUTBOX_KEY}"
    echo "[+] Preservando EMAIL_OUTBOX_ENCRYPTION_KEY existente válida e independiente."
else
    EMAIL_OUTBOX_ENCRYPTION_KEY=$(openssl rand -hex 32 || head -c 64 /dev/urandom | xxd -p | tr -d '\n')
    echo "[+] Generada nueva EMAIL_OUTBOX_ENCRYPTION_KEY independiente de 32 bytes (64 hex)."
fi

EMAIL_OUTBOX_LEGACY_KEY_V0="${EXISTING_LEGACY_KEY:-${MFA_MASTER_KEY}}"

# 7. Escribir /etc/politica-canon/runtime.env.tmp de forma atómica y restrictiva con umask 0077
TMP_ENV="/etc/politica-canon/runtime.env.tmp"
(
    umask 0077
    touch "${TMP_ENV}"
    chmod 0640 "${TMP_ENV}"
    cat <<EOF > "${TMP_ENV}"
# Configuración de tiempo de ejecución Política Canon v0.3.27
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
APP_BASE_URL=https://peaceful-johnson.194-164-175-146.plesk.page
REDIS_URL=redis://127.0.0.1:6379/0
DATABASE_URL=${DERIVED_DB_URL}
EMAIL_WORKER_DATABASE_URL=${DERIVED_EMAIL_WORKER_URL}
POLITICA_CANON_WORKER_DB_PASS=${WORKER_DB_PASS}
SESSION_SECRET=${SESSION_SECRET}
MFA_MASTER_KEY=${MFA_MASTER_KEY}
EMAIL_OUTBOX_ENCRYPTION_KEY=${EMAIL_OUTBOX_ENCRYPTION_KEY}
EMAIL_OUTBOX_LEGACY_KEY_V0=${EMAIL_OUTBOX_LEGACY_KEY_V0}
SMTP_HOST=${EXISTING_SMTP_HOST}
SMTP_PORT=${EXISTING_SMTP_PORT:-587}
SMTP_USER=${EXISTING_SMTP_USER}
SMTP_PASS=${EXISTING_SMTP_PASS}
SMTP_FROM=${EXISTING_SMTP_FROM}
SMTP_SECURE=${EXISTING_SMTP_SECURE:-false}
EOF
)

# Validar contenido obligatorio antes de reemplazar
if ! grep -q "^SESSION_SECRET=" "${TMP_ENV}" || ! grep -q "^MFA_MASTER_KEY=" "${TMP_ENV}" || ! grep -q "^EMAIL_OUTBOX_ENCRYPTION_KEY=" "${TMP_ENV}" || ! grep -q "^DATABASE_URL=" "${TMP_ENV}" || ! grep -q "^EMAIL_WORKER_DATABASE_URL=" "${TMP_ENV}"; then
    echo "❌ ERROR FATAL: El archivo de entorno temporal no contiene las variables obligatorias. Abortando provisión."
    rm -f "${TMP_ENV}"
    exit 1
fi

mv "${TMP_ENV}" /etc/politica-canon/runtime.env
chown root:politica-canon /etc/politica-canon/runtime.env
chmod 0640 /etc/politica-canon/runtime.env
echo "[+] Archivo /etc/politica-canon/runtime.env configurado de forma atómica con propietario root:politica-canon y modo 0640."

# 8. Instalar e Iniciar Unidades de Servicio Systemd (C-02 Secuenciación Fail-Closed)
if [ -f /opt/politica-canon/app/deploy/systemd/politica-canon.service ]; then
    echo "[+] Instalando servicio web systemd..."
    cp /opt/politica-canon/app/deploy/systemd/politica-canon.service /etc/systemd/system/
else
    echo "❌ ERROR FATAL: /opt/politica-canon/app/deploy/systemd/politica-canon.service no encontrado."
    exit 1
fi

if [ -f /opt/politica-canon/app/deploy/systemd/politica-canon-outbox-worker.service ]; then
    echo "[+] Instalando servicio worker autónomo de correo outbox systemd..."
    cp /opt/politica-canon/app/deploy/systemd/politica-canon-outbox-worker.service /etc/systemd/system/
else
    echo "❌ ERROR FATAL: /opt/politica-canon/app/deploy/systemd/politica-canon-outbox-worker.service no encontrado."
    exit 1
fi

echo "[+] Recargando unidades systemd y registrando habilitación (enable)..."
systemctl daemon-reload
systemctl enable politica-canon.service
systemctl enable politica-canon-outbox-worker.service

# C-02: Comprobar si las migraciones de base de datos han sido aplicadas antes de iniciar los servicios
HAS_OUTBOX=$(PGPASSWORD="${WORKER_DB_PASS}" psql -h 127.0.0.1 -U politica_canon_email_worker -d politica_canon -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_outbox';" 2>/dev/null || true)

if [ "${HAS_OUTBOX}" = "1" ]; then
    echo "[+] Esquema de base de datos e historia de migraciones verificados. Iniciando servicios..."
    systemctl start politica-canon.service
    systemctl start politica-canon-outbox-worker.service

    # Verificación Fail-Closed de Estado Activo
    if ! systemctl is-active --quiet politica-canon.service; then
        echo "❌ ERROR FATAL: politica-canon.service no se encuentra en estado activo tras la provisión."
        exit 1
    fi

    if ! systemctl is-active --quiet politica-canon-outbox-worker.service; then
        echo "❌ ERROR FATAL: politica-canon-outbox-worker.service no se encuentra en estado activo tras la provisión."
        exit 1
    fi
    echo "[+] Servicios systemd verificados y activos."
else
    echo "ℹ️ [DESPLIEGUE INICIAL / SECUENCIACIÓN C-02] La tabla 'email_outbox' no existe aún en la base de datos. Unidades systemd registradas y habilitadas (enable). Ejecutar ahora: 'npm run bootstrap:pre && npm run migrate:prod && npm run bootstrap:post' y posteriormente 'systemctl start politica-canon.service politica-canon-outbox-worker.service'."
fi

echo "== [POLÍTICA CANON v0.3.27] Provisión completada exitosamente =="
