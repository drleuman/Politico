#!/usr/bin/env bash
# Script de Provisión Inicial de Servidor — Política Canon v0.3.0
# Ejecutar en el servidor Ubuntu 24.04 / Plesk como root o con sudo

set -euo pipefail

echo "== [POLÍTICA CANON v0.3.0] Provisión Inicial de Servidor =="

# 1. Crear usuario del sistema sin shell interactiva
if ! id -u politica-canon >/dev/null 2>&1; then
    echo "[+] Creando usuario de sistema 'politica-canon'..."
    useradd -r -s /bin/false politica-canon
fi

# 2. Crear directorios de la aplicación y configuración
mkdir -p /opt/politica-canon/app
mkdir -p /etc/politica-canon
mkdir -p /var/log/politica-canon

# 3. Establecer permisos estrictos
chown -R politica-canon:politica-canon /opt/politica-canon
chown -R politica-canon:politica-canon /var/log/politica-canon

# 4. Aislamiento del archivo de entorno runtime.env
if [ ! -f /etc/politica-canon/runtime.env ]; then
    echo "[+] Inicializando /etc/politica-canon/runtime.env..."
    touch /etc/politica-canon/runtime.env
    chown root:politica-canon /etc/politica-canon/runtime.env
    chmod 0640 /etc/politica-canon/runtime.env
    echo "# Configuración de tiempo de ejecución Política Canon v0.3.0" > /etc/politica-canon/runtime.env
    echo "# Rellenar las variables obligatorias: NODE_ENV, PORT, HOST, APP_BASE_URL, REDIS_URL, DATABASE_URL, SESSION_SECRET" >> /etc/politica-canon/runtime.env
fi

# 5. Instalar unidad de servicio systemd
if [ -f /opt/politica-canon/app/deploy/systemd/politica-canon.service ]; then
    echo "[+] Instalando servicio systemd..."
    cp /opt/politica-canon/app/deploy/systemd/politica-canon.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable politica-canon
fi

echo "== [POLÍTICA CANON v0.3.0] Provisión completada exitosamente =="
