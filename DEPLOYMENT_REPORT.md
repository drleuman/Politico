# Informe de Despliegue y Guía de Aprovisionamiento — Política Canon v0.2.18 (Fase 1 MVP)

**Fecha:** 16 de septiembre de 2026  
**Dominio Target:** `peaceful-johnson.194-164-175-146.plesk.page`  
**Entorno de Servidor:** Plesk Obsidian 18.0.80 / Ubuntu 24.04.5 LTS  
**Motor de Aplicación:** Node.js 22.23.2 / Fastify TypeScript Monolith  
**Motores Canónicos de Persistencia:** PostgreSQL 16.15 / Redis 7.0.15  
**Estado:** **Fase 1 MVP Construido y Listo para Despliegue Seguro**

---

## 1. Especificaciones del Entorno y Versiones Verificadas

- **Sistema Operativo:** Ubuntu 24.04.5 LTS (Kernel intacto, sin reinicio ni upgrades del sistema)
- **Panel:** Plesk Obsidian 18.0.80
- **Node.js:** v22.23.2 | **npm:** v10.9.3
- **PostgreSQL:** 16.15 (Limitado a `127.0.0.1` / `::1`)
- **Redis:** 7.0.15 (Limitado a `127.0.0.1` / `::1`)
- **Base de Datos:** `politica_canon`
- **Rol Runtime PostgreSQL:** `politica_canon_app` (Conexiones máx 20, sin superusuario, `NOBYPASSRLS`)

---

## 2. Instrucciones de Aprovisionamiento y DesplieguePaso a Paso

### 2.1. Creación de Directorios y Usuario de Servicio

```bash
# 1. Crear usuario de sistema sin shell interactiva
sudo useradd -r -s /bin/false politica-canon

# 2. Crear directorios de aplicación
sudo mkdir -p /opt/politica-canon/app
sudo mkdir -p /etc/politica-canon

# 3. Asignar propiedad
sudo chown -R politica-canon:politica-canon /opt/politica-canon

# 4. Desplegar el código fuente desde el repositorio GitHub (o paquete v0.2.18)
# Opción A (Recomendada): Clonar desde el repositorio oficial GitHub
sudo git clone https://github.com/drleuman/Politico.git /opt/politica-canon/app
sudo chown -R politica-canon:politica-canon /opt/politica-canon/app

# Opción B: Copiar paquete v0.2.18 ZIP
# sudo cp -r . /opt/politica-canon/app/
# sudo chown -R politica-canon:politica-canon /opt/politica-canon/app

# 5. Instalar dependencias y compilar monolito
cd /opt/politica-canon/app
sudo -u politica-canon npm ci
sudo -u politica-canon npm run typecheck
sudo -u politica-canon npm test
sudo -u politica-canon npm run build
```

---

### 2.2. Aislamiento de Secretos y Configuración de Entorno

Conservar `/root/politica-canon/runtime.env` intacto en modo `0600`. Crear `/etc/politica-canon/runtime.env` (propietario `root:politica-canon`, modo `0640`):

```bash
sudo touch /etc/politica-canon/runtime.env
sudo chown root:politica-canon /etc/politica-canon/runtime.env
sudo chmod 0640 /etc/politica-canon/runtime.env
```

Contenido de `/etc/politica-canon/runtime.env` (la variable `DATABASE_URL` se deriva de `POLITICA_CANON_DATABASE_URL` leída de forma segura desde `/root/politica-canon/runtime.env` dentro del servidor sin exponer claves):

```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
APP_BASE_URL=https://peaceful-johnson.194-164-175-146.plesk.page
REDIS_URL=redis://127.0.0.1:6379/0
DATABASE_URL=postgresql://politica_canon_app:<PASSWORD>@127.0.0.1:5432/politica_canon
SESSION_SECRET=<GENERATED_32_PLUS_BYTES_RANDOM_SECRET>
```

---

### 2.3. Configuración del Servicio systemd (`politica-canon.service`)

Crear `/etc/systemd/system/politica-canon.service`:

```ini
[Unit]
Description=Politica Canon Monolith Service
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=politica-canon
Group=politica-canon
WorkingDirectory=/opt/politica-canon/app
EnvironmentFile=/etc/politica-canon/runtime.env
ExecStart=/usr/bin/node /opt/politica-canon/app/dist/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/politica-canon

[Install]
WantedBy=multi-user.target
```

Habilitar e iniciar el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable politica-canon
sudo systemctl start politica-canon
sudo systemctl status politica-canon
```

---

### 2.4. Configuración del Reverse Proxy Nginx en Plesk

En el panel Plesk para el dominio `peaceful-johnson.194-164-175-146.plesk.page`, agregar en **Apache & Nginx Settings** $\rightarrow$ **Additional Nginx Directives**:

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

### 2.5. Copia de Seguridad Pre-Migración de Base de Datos

```bash
sudo mkdir -p /root/politica-canon/backups
sudo chmod 0700 /root/politica-canon/backups
sudo pg_dump --format=custom --file=/root/politica-canon/backups/pre-migration-$(date +%Y%m%d_%H%M%S).dump politica_canon
sudo chmod 0600 /root/politica-canon/backups/*.dump
```

---

## 3. Comandos de Validación y Control Obligatorios

Ejecutar las siguientes verificaciones para confirmar el estado de salud del despliegue:

```bash
# 1. Verificación de versiones
node --version
npm --version

# 2. Verificación de servicios activos
systemctl is-active postgresql redis-server politica-canon

# 3. Verificación de probes HTTP locales (Liveness & Readiness)
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://127.0.0.1:3000/readyz

# 4. Verificación de HTTPS y Reverse Proxy Nginx
curl -fsSI https://peaceful-johnson.194-164-175-146.plesk.page

# 5. Verificación de conexión y usuario PostgreSQL
sudo -u postgres psql -d politica_canon -c "SELECT current_database(), current_user;"

# 6. Verificación de aislamiento de red (Loopback 127.0.0.1 solamente)
ss -lntp | grep -E '3000|5432|6379'
```

---

## 4. Garantía de Aislamiento y Política de Cero Fugas de Secretos

- No existen contraseñas, secretos, tokens ni URLs de base de datos impresas en este reporte.
- Fastify está configurado con `trustProxy: true` y escucha exclusivamente en `127.0.0.1:3000`.
- PostgreSQL (5432) y Redis (6379) permanecen estrictamente privados en `127.0.0.1`.
- La portada de la Intranet Privada («Política Canon — Intranet en preparación») se sirve en `https://peaceful-johnson.194-164-175-146.plesk.page` bajo principio de *Default-Deny*.
