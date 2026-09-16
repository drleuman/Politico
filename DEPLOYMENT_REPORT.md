# Informe de Despliegue y Guía de Aprovisionamiento — Política Canon v0.3.2 (Fase 1 MVP)

**Fecha:** 16 de septiembre de 2026  
**Dominio Target:** `peaceful-johnson.194-164-175-146.plesk.page`  
**Entorno de Servidor:** Plesk Obsidian 18.0.80 / Ubuntu 24.04.5 LTS  
**Motor de Aplicación:** Node.js 22.23.2 / Fastify TypeScript Monolith  
**Motores Canónicos de Persistencia:** PostgreSQL 16.15 / Redis 7.0.15  
**Estado:** **Fase 1 MVP Remediado 100% y Aprobado para Despliegue v0.3.2**

---

## 1. Especificaciones del Entorno y Versiones Verificadas

- **Sistema Operativo:** Ubuntu 24.04.5 LTS (Kernel intacto, sin reinicio ni upgrades del sistema)
- **Panel:** Plesk Obsidian 18.0.80
- **Node.js:** v22.23.2 | **npm:** v10.9.3
- **PostgreSQL:** 16.15 (Limitado a `127.0.0.1` / `::1`)
- **Redis:** 7.0.15 (Limitado a `127.0.0.1` / `::1`)
- **Base de Datos:** `politica_canon`
- **Rol Runtime PostgreSQL:** `politica_canon_app` (Conexiones máx 10, pertenece a `app_user`, `NOSUPERUSER`, `NOBYPASSRLS`)

---

## 2. Instrucciones de Aprovisionamiento y Despliegue Paso a Paso

### 2.1. Provisión Inicial de Servidor y Secretos (`deploy/scripts/provision.sh`)

```bash
# 1. Ejecutar script de provisión inicial (crea usuario 'politica-canon', carpetas, permisos y SESSION_SECRET de 32+ bytes)
sudo bash /opt/politica-canon/app/deploy/scripts/provision.sh
```

---

### 2.2. Secuenciación de Base de Datos en 3 Fases (C-01, C-02)

#### Fase 1: Pre-Bootstrap de Roles (Ejecutado como usuario Unix `postgres`)
```bash
cd /opt/politica-canon/app
sudo -u postgres npm run bootstrap:pre
```

#### Fase 2: Copia de Seguridad y Migración DDL (Ejecutado por rol de migración)
```bash
# Copia de seguridad pre-migración
sudo mkdir -p /root/politica-canon/backups
sudo chmod 0700 /root/politica-canon/backups
sudo -u postgres pg_dump --format=custom --file=/root/politica-canon/backups/pre-migration-$(date +%Y%m%d_%H%M%S).dump politica_canon
sudo chmod 0600 /root/politica-canon/backups/*.dump

# Migración DDL idempotente con Advisory Lock
sudo -u politica-canon npm run migrate:prod
```

#### Fase 3: Post-Bootstrap de Propiedad, Permisos DML y RLS (Ejecutado como usuario Unix `postgres`)
```bash
sudo -u postgres npm run bootstrap:post
```

---

### 2.3. Instalación del Servicio systemd Versionado (`deploy/systemd/politica-canon.service`)

```bash
sudo cp /opt/politica-canon/app/deploy/systemd/politica-canon.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable politica-canon
sudo systemctl start politica-canon
sudo systemctl status politica-canon
```

---

### 2.4. Configuración del Reverse Proxy Nginx con Auth Basic (`deploy/plesk/vhost_nginx.conf`)

1. Generar credencial HTTP Basic Nginx en `/etc/nginx/htpasswd_politica_canon`:
   ```bash
   sudo htpasswd -c /etc/nginx/htpasswd_politica_canon admin
   sudo chmod 0640 /etc/nginx/htpasswd_politica_canon
   sudo chown root:www-data /etc/nginx/htpasswd_politica_canon
   ```

2. Aplicar la configuración de `deploy/plesk/vhost_nginx.conf` en el panel Plesk (**Apache & Nginx Settings** $\rightarrow$ **Additional Nginx Directives**):

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

    auth_basic "Acceso Restringido — Intranet Política Canon";
    auth_basic_user_file /etc/nginx/htpasswd_politica_canon;
}
```

---

## 3. Comandos de Validación y Control Obligatorios

```bash
# 1. Verificación de compilación y arnés de pruebas autocontenido (C-01)
cd /opt/politica-canon/app
sudo -u politica-canon npm test

# 2. Verificación de servicios activos
systemctl is-active postgresql redis-server politica-canon

# 3. Verificación de probes HTTP locales (Liveness & Readiness)
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://127.0.0.1:3000/readyz

# 4. Verificación de HTTPS y Autenticación Nginx
curl -fsSI https://peaceful-johnson.194-164-175-146.plesk.page

# 5. Verificación de aislamiento de red (Loopback 127.0.0.1 solamente)
ss -lntp | grep -E '3000|5432|6379'
```

---

## 4. Garantía de Aislamiento y Política de Cero Fugas

- Cero contraseñas ni variables con secretos en el repositorio ni documentación.
- Fastify escucha exclusivamente en `127.0.0.1:3000` con `trustProxy: true`.
- PostgreSQL (5432) y Redis (6379) permanecen estrictamente limitados a `127.0.0.1`.
- Rol runtime `politica_canon_app` opera bajo principio de mínimo privilegio (`NOSUPERUSER`, `NOBYPASSRLS`).
