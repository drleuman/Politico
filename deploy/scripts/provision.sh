#!/usr/bin/env bash
# Script de Provisión Inicial de Servidor — Política Canon v0.3.8
# Ejecutar en el servidor Ubuntu 24.04 / Plesk como root o con sudo

set -euo pipefail

echo "== [POLÍTICA CANON v0.3.8] Provisión Inicial de Servidor =="

# 1. Crear usuario del sistema sin shell interactiva
if ! id -u politica-canon >/dev/null 2>&1; then
    echo "[+] Creando usuario de sistema 'politica-canon'..."
    useradd -r -s /bin/false politica-canon
fi

# 2. Crear directorios de la aplicación y configuración
mkdir -p /opt/politica-canon/app
mkdir -p /etc/politica-canon
mkdir -p /var/log/politica-canon

# 3. Establecer permisos strictly
chown -R politica-canon:politica-canon /opt/politica-canon
chown -R politica-canon:politica-canon /var/log/politica-canon

# 4. H-03: Derivar contraseña real si existe /root/politica-canon/runtime.env
DB_PASS=""
if [ -f /root/politica-canon/runtime.env ]; then
    DB_PASS=$(grep -E '^POLITICA_CANON_DB_PASS=' /root/politica-canon/runtime.env | cut -d'=' -f2- || true)
fi

# Fallar cerrado inmediatamente si el secreto no existe o está vacío (H-03)
if [ -z "${DB_PASS}" ]; then
    echo "❌ ERROR FATAL (H-03): No se pudo derivar la contraseña de la base de datos de /root/politica-canon/runtime.env (POLITICA_CANON_DB_PASS). Abortando por fallo cerrado sin crear runtime.env."
    exit 1
fi

# 5. Generación segura del archivo runtime.env y secreto de sesión (32+ bytes)
if [ ! -f /etc/politica-canon/runtime.env ]; then
    echo "[+] Inicializando /etc/politica-canon/runtime.env..."
    touch /etc/politica-canon/runtime.env
    chown root:politica-canon /etc/politica-canon/runtime.env
    chmod 0640 /etc/politica-canon/runtime.env
    
    RANDOM_SECRET=$(openssl rand -hex 32 || head -c 64 /dev/urandom | xxd -p | tr -d '\n')
    
    cat <<EOF > /etc/politica-canon/runtime.env
# Configuración de tiempo de ejecución Política Canon v0.3.8
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
APP_BASE_URL=https://peaceful-johnson.194-164-175-146.plesk.page
REDIS_URL=redis://127.0.0.1:6379/0
DATABASE_URL=postgresql://politica_canon_app:${DB_PASS}@127.0.0.1:5432/politica_canon
SESSION_SECRET=${RANDOM_SECRET}
EOF
    echo "[+] Secreto de sesión SESSION_SECRET (64 hex / 32+ bytes) generado automáticamente de forma segura."
fi

# 6. Instalar unidad de servicio systemd
if [ -f /opt/politica-canon/app/deploy/systemd/politica-canon.service ]; then
    echo "[+] Instalando servicio systemd..."
    cp /opt/politica-canon/app/deploy/systemd/politica-canon.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable politica-canon
fi

echo "== [POLÍTICA CANON v0.3.8] Provisión completada exitosamente =="
