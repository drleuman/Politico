# Informe de Despliegue y Guía de Aprovisionamiento — Política Canon v0.3.0 (Fase 1 MVP)

**Fecha:** 16 de septiembre de 2026  
**Dominio Target:** `peaceful-johnson.194-164-175-146.plesk.page`  
**Entorno de Servidor:** Plesk Obsidian 18.0.80 / Ubuntu 24.04.5 LTS  
**Motor de Aplicación:** Node.js 22.23.2 / Fastify TypeScript Monolith  
**Motores Canónicos de Persistencia:** PostgreSQL 16.15 / Redis 7.0.15  
**Estado:** **Fase 1 MVP Remediado y Listo para Despliegue v0.3.0**

---

## 1. Especificaciones del Entorno y Versiones Verificadas

- **Sistema Operativo:** Ubuntu 24.04.5 LTS (Kernel intacto, sin reinicio ni upgrades del sistema)
- **Panel:** Plesk Obsidian 18.0.80
- **Node.js:** v22.23.2 | **npm:** v10.9.3
- **PostgreSQL:** 16.15 (Limitado a `127.0.0.1` / `::1`)
- **Redis:** 7.0.15 (Limitado a `127.0.0.1` / `::1`)
- **Base de Datos:** `politica_canon`
- **Rol Runtime PostgreSQL:** `politica_canon_app` (Conexiones máx 10, sin superusuario, `NOBYPASSRLS`)

---

## 2. Instrucciones de Aprovisionamiento y Despliegue Paso a Paso

### 2.1. Provisión Inicial mediante Script Versionado (`deploy/scripts/provision.sh`)

```bash
# Ejecutar script de provisión inicial (crea usuario de sistema 'politica-canon', directorios y permisos)
sudo bash /opt/politica-canon/app/deploy/scripts/provision.sh
```

---

### 2.2. Aislamiento de Secretos y Configuración de Entorno

Conservar `/root/politica-canon/runtime.env` intacto en modo `0600`. Crear `/etc/politica-canon/runtime.env` (propietario `root:politica-canon`, modo `0640`):

```bash
sudo touch /etc/politica-canon/runtime.env
sudo chown root:politica-canon /etc/politica-canon/runtime.env
sudo chmod 0640 /etc/politica-canon/runtime.env
```

Variables obligatorias requeridas en `/etc/politica-canon/runtime.env` (sin exponer credenciales en la documentación):

```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
APP_BASE_URL=https://peaceful-johnson.194-164-175-146.plesk.page
REDIS_URL=
DATABASE_URL=
SESSION_SECRET=
```

---

### 2.3. Copia de Seguridad Pre-Migración y Ejecución de Migrador Idempotente

```bash
# 1. Copia de seguridad pre-migración ejecutada como usuario postgres
sudo mkdir -p /root/politica-canon/backups
sudo chmod 0700 /root/politica-canon/backups
sudo -u postgres pg_dump --format=custom --file=/root/politica-canon/backups/pre-migration-$(date +%Y%m%d_%H%M%S).dump politica_canon
sudo chmod 0600 /root/politica-canon/backups/*.dump

# 2. Ejecución del migrador versionado e idempotente
cd /opt/politica-canon/app
sudo -u politica-canon npm run migrate:prod
```

---

### 2.4. Instalación de Servicio systemd Versionado (`deploy/systemd/politica-canon.service`)

```bash
sudo cp /opt/politica-canon/app/deploy/systemd/politica-canon.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable politica-canon
sudo systemctl start politica-canon
sudo systemctl status politica-canon
```

---

### 2.5. Configuración del Reverse Proxy Nginx en Plesk (`deploy/plesk/vhost_nginx.conf`)

Copiar el contenido de `deploy/plesk/vhost_nginx.conf` a la sección **Apache & Nginx Settings** $\rightarrow$ **Additional Nginx Directives** del dominio Plesk:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

---

## 3. Comandos de Validación y Control Obligatorios

```bash
# 1. Verificación de versiones
node --version
npm --version

# 2. Verificación de servicios activos
systemctl is-active postgresql redis-server politica-canon

# 3. Verificación de probes HTTP locales (Liveness & Readiness)
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://127.0.0.1:3000/readyz

# 4. Verificación de HTTPS y Proxy Intranet Privada
curl -fsSI https://peaceful-johnson.194-164-175-146.plesk.page

# 5. Verificación de aislamiento de red (Loopback 127.0.0.1 solamente)
ss -lntp | grep -E '3000|5432|6379'
```

---

## 4. Garantía de Aislamiento y Política de Cero Fugas

- Cero contraseñas ni variables con secretos en el repositorio ni documentación.
- Fastify escucha exclusivamente en `127.0.0.1:3000` con `trustProxy: true`.
- PostgreSQL (5432) y Redis (6379) permanecen estrictamente limitados a `127.0.0.1`.
- Portada de Intranet Privada protegida sin divulgación de versiones ni metadatos de plataforma.
