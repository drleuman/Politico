#!/usr/bin/env bash
# Script de Provisión Inicial de Servidor — Política Canon v0.3.16
# Ejecutar en el servidor Ubuntu 24.04 / Plesk como root o con sudo

set -euo pipefail

echo "== [POLÍTICA CANON v0.3.16] Provisión Inicial de Servidor =="

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
find /opt/politica-canon/app -type d -exec chmod 0750 {} +
find /opt/politica-canon/app -type f -exec chmod 0640 {} +
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

# 5. Recuperar o generar SESSION_SECRET (32+ bytes / 64+ hex)
EXISTING_SECRET=""
if [ -f /etc/politica-canon/runtime.env ]; then
    EXISTING_SECRET=$(grep -E '^SESSION_SECRET=' /etc/politica-canon/runtime.env | cut -d'=' -f2- || true)
fi

if [ -n "${EXISTING_SECRET}" ] && [ "${#EXISTING_SECRET}" -ge 32 ]; then
    SESSION_SECRET="${EXISTING_SECRET}"
    echo "[+] Preservando SESSION_SECRET existente válido."
else
    SESSION_SECRET=$(openssl rand -hex 32 || head -c 64 /dev/urandom | xxd -p | tr -d '\n')
    echo "[+] Generado nuevo SESSION_SECRET de 32 bytes (64 hex)."
fi

# 6. Escribir /etc/politica-canon/runtime.env con permisos strictly root:politica-canon 0640 (Sin imprimir secretos)
cat <<EOF > /etc/politica-canon/runtime.env
# Configuración de tiempo de ejecución Política Canon v0.3.11
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
APP_BASE_URL=https://peaceful-johnson.194-164-175-146.plesk.page
REDIS_URL=redis://127.0.0.1:6379/0
DATABASE_URL=${DERIVED_DB_URL}
SESSION_SECRET=${SESSION_SECRET}
EOF

chown root:politica-canon /etc/politica-canon/runtime.env
chmod 0640 /etc/politica-canon/runtime.env
echo "[+] Archivo /etc/politica-canon/runtime.env configurado con propietario root:politica-canon y modo 0640."

# 7. Instalar unidad de servicio systemd
if [ -f /opt/politica-canon/app/deploy/systemd/politica-canon.service ]; then
    echo "[+] Instalando servicio systemd..."
    cp /opt/politica-canon/app/deploy/systemd/politica-canon.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable politica-canon
fi

echo "== [POLÍTICA CANON v0.3.11] Provisión completada exitosamente =="


