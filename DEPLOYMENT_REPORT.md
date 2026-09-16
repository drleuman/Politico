# Informe de Despliegue y Guía de Aprovisionamiento — Política Canon v0.3.17 (Fase 1.1)

**Fecha de Despliegue en Producción:** 17 de septiembre de 2026  
**Commit / Tag Desplegado:** Tag `v0.3.17` (`ed74688`)  
**Dominio Target:** `peaceful-johnson.194-164-175-146.plesk.page`  
**Entorno de Servidor:** Plesk Obsidian 18.0.80 / Ubuntu 24.04.5 LTS  
**Motor de Aplicación:** Node.js 22.23.2 / Fastify TypeScript Monolith  
**Motores Canónicos de Persistencia:** PostgreSQL 16.15 / Redis 7.0.15  
**Estado de Producción:** **DESPLEGADO Y VERIFICADO EN VIVO 100% (PASS — v0.3.17)**

---

## 1. Especificaciones del Entorno y Versiones Verificadas

- **Sistema Operativo:** Ubuntu 24.04.5 LTS (Kernel intacto, sin reinicio ni upgrades del sistema)
- **Panel:** Plesk Obsidian 18.0.80
- **Node.js:** v22.23.2 | **npm:** v10.9.3
- **PostgreSQL:** 16.15 (Limitado a `127.0.0.1` / `::1`)
- **Redis:** 7.0.15 (Limitado a `127.0.0.1` / `::1`)
- **Base de Datos:** `politica_canon`
- **Rol Runtime PostgreSQL:** `politica_canon_app` (Conexiones máx 10, pertenece a `app_user`, `NOSUPERUSER`, `NOBYPASSRLS`, no propietario de objetos ni base, `GRANT CONNECT ON DATABASE politica_canon`)

---

## 2. Modelo de Permisos y Estructura de Grupos en Sistema (B-02)

Para garantizar la reproducibilidad y la ejecución segura de las tres fases del bootstrap de base de datos sin elevar privilegios del rol runtime, sin exponer archivos sensibles al sistema y cerrando la lectura a usuarios universales no autorizados (B-02):

1. **Usuario de Servicio:** `politica-canon` (sistema, sin directorio home interactivo `/bin/false`).
2. **Pertenencia a Grupo Restringido:** El usuario de sistema Unix `postgres` se añade al grupo `politica-canon`:
   ```bash
   sudo usermod -aG politica-canon postgres
   ```
3. **Directorios de Código (`/opt/politica-canon` y `/opt/politica-canon/app`):** Permisos `0750` con propietario `politica-canon:politica-canon`:
   ```bash
   sudo chown -R politica-canon:politica-canon /opt/politica-canon/app
   sudo chmod 0750 /opt/politica-canon
   sudo find /opt/politica-canon/app -type d -exec chmod 0750 {} +
   ```
   Esto permite la traversabilidad y lectura por parte del usuario Unix `postgres` únicamente por ser miembro del grupo `politica-canon` para ejecutar los scripts de bootstrap (`bootstrap:pre`, `migrate:prod`, `bootstrap:post`), manteniendo el repositorio oculto e inaccesible para usuarios no autorizados (no `0755` universal).
4. **Archivos de Código (`/opt/politica-canon/app`):** Permisos `0640` con propietario `politica-canon:politica-canon`:
   ```bash
   sudo find /opt/politica-canon/app -type f -exec chmod 0640 {} +
   ```
5. **Caché npm Controlada (`/opt/politica-canon/.npm-cache`):** Propiedad de `politica-canon:politica-canon` con modo `0750`.
6. **Archivo de Configuración Runtime (`/etc/politica-canon/runtime.env`):** Propiedad `root:politica-canon` con modo `0640`. No accesible por otros usuarios ni por el repositorio git.
7. **Backups Pre-Migración (`/root/politica-canon/backups`):** Directorio restringido `root:root` modo `0700`, archivos `.dump` en modo `0600`.

---

## 3. Instrucciones de Aprovisionamiento y Despliegue Paso a Paso

### 3.1. Provisión Inicial de Servidor y Secretos (`deploy/scripts/provision.sh`)

```bash
# 1. Crear /root/politica-canon/runtime.env con POLITICA_CANON_DATABASE_URL
sudo mkdir -p /root/politica-canon
sudo chmod 0700 /root/politica-canon
echo "POLITICA_CANON_DATABASE_URL=postgresql://politica_canon_app:<PASSWORD>@127.0.0.1:5432/politica_canon" | sudo tee /root/politica-canon/runtime.env
sudo chmod 0600 /root/politica-canon/runtime.env

# 2. Ejecutar script de provisión inicial (crea usuario 'politica-canon', añade postgres al grupo, carpetas, permisos 0750/0640 y SESSION_SECRET de 32+ bytes)
sudo bash /opt/politica-canon/app/deploy/scripts/provision.sh
```

---

### 3.2. Secuenciación de Base de Datos en 3 Fases

#### Copia de Seguridad Pre-Migración (Patrón Seguro de Redirección)
```bash
sudo mkdir -p /root/politica-canon/backups
sudo chmod 0700 /root/politica-canon/backups
backup="/root/politica-canon/backups/pre-migration-$(date +%Y%m%d_%H%M%S).dump"
sudo -u postgres pg_dump --format=custom politica_canon > "$backup"
sudo chmod 0600 "$backup"
```

#### Fase 1: Pre-Bootstrap de Roles y pgcrypto (Ejecutado como `postgres` vía Socket Unix)
```bash
cd /opt/politica-canon/app
sudo -u postgres npm run bootstrap:pre
```

#### Fase 2: Migración DDL (Ejecutado como conexión administrativa local con `SET ROLE app_owner`)
```bash
sudo -u postgres MIGRATION_DATABASE_URL="postgresql:///politica_canon?host=/var/run/postgresql" npm run migrate:prod
```

#### Fase 3: Post-Bootstrap de Propiedad, Permisos DML Mínimos, Excepciones de Auditoría y RLS (Ejecutado como `postgres` vía Socket Unix)
```bash
sudo -u postgres npm run bootstrap:post
```

---

### 3.3. Instalación del Servicio systemd Versionado (`deploy/systemd/politica-canon.service`)

```bash
sudo cp /opt/politica-canon/app/deploy/systemd/politica-canon.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable politica-canon
sudo systemctl start politica-canon
sudo systemctl status politica-canon
```

---

### 3.4. Configuración del Proxy Dual Nginx + Apache en Plesk con Auth Basic

En Plesk Obsidian, Nginx actúa como frontend SSL y Apache como proxy interno de la aplicación Node.js.

#### 1. Generación de Credencial HTTP Basic Nginx
```bash
# Generar la contraseña inicial guardándola temporalmente en un archivo restringido en /root
openssl rand -base64 16 > /root/politica-canon/initial_pass.txt
sudo chmod 0600 /root/politica-canon/initial_pass.txt

# Generar archivo htpasswd para Nginx (grupo nginx)
sudo htpasswd -cb /etc/nginx/htpasswd_politica_canon admin $(cat /root/politica-canon/initial_pass.txt)
sudo chmod 0640 /etc/nginx/htpasswd_politica_canon
sudo chown root:nginx /etc/nginx/htpasswd_politica_canon

# Una vez transferida la contraseña al gestor seguro de contraseñas de la organización, eliminar el archivo temporal:
sudo rm -f /root/politica-canon/initial_pass.txt
```

#### 2. Configuración en Directivas Nginx de Plesk (**Apache & Nginx Settings** $\rightarrow$ **Additional Nginx Directives**)
*Importante:* No declarar un bloque `location /` adicional para evitar la colisión `duplicate location "/"` generada por Plesk.
```nginx
# Aplicar Auth Basic en el ámbito de servidor Nginx
auth_basic "Acceso Restringido — Intranet Política Canon";
auth_basic_user_file /etc/nginx/htpasswd_politica_canon;
```

#### 3. Configuración en Directivas Apache de Plesk (**Additional Apache Directives**)
Directivas para HTTP y HTTPS:
```apache
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/
RequestHeader set X-Forwarded-Proto "https"
```

---

## 4. Plan de Verificación Post-Despliegue y Rollback

### 4.1. Verificación en Vivo (Smoke Test)
```bash
# Probes locales de disponibilidad en la máquina de aplicación
curl -sS http://127.0.0.1:3000/healthz | grep '"status":"ok"'
curl -sS http://127.0.0.1:3000/readyz | grep '"status":"ready"'

# Verificación de autenticación pública HTTPS vía Nginx
# 1. Sin credenciales -> Debe devolver HTTP 401 Unauthorized
curl -sI https://peaceful-johnson.194-164-175-146.plesk.page/ | grep "401 Unauthorized"

# 2. Con credenciales válidas -> Debe devolver HTTP 200 OK
curl -u admin:<PASSWORD> -sI https://peaceful-johnson.194-164-175-146.plesk.page/ | grep "200 OK"
```

### 4.2. Procedimiento de Emergencia (Rollback)
```bash
sudo systemctl stop politica-canon
sudo -u postgres pg_restore --clean --dbname=politica_canon /root/politica-canon/backups/<ULTIMO_DUMP>.dump
```

---

## 5. Registro de Evidencia de Despliegue en Producción — Release v0.3.17

- **Fecha y Hora de Ejecución:** 17 de septiembre de 2026
- **Tag Desplegado:** `v0.3.17` (Commit `ed74688` en `main`)
- **Copia de Seguridad Pre-Migración Realizada:**
  - Archivo: `/root/politica-canon/backups/pre-v0.3.17-20260916_224717.dump`
  - SHA-256: `cf3488738545b9cb9b78428a4ff70fc1ad3c43fb081045f9ff3d86c8d18e19ac`
- **Migraciones DDL Aplicadas:**
  - `0001_initial_schema.sql` (Verificada por checksum previo)
  - `0003_fase_1_1_identity_rbac.sql` (Aplicada exitosamente)
  - `0004_fase_1_1_token_resolver_fix.sql` (Aplicada exitosamente)
- **Verificación de Seguridad Post-Bootstrap:**
  - Propiedad de BD asignada autoritativamente a `app_owner`.
  - Permisos mínimos DML revocados/concedidos a `app_user`.
  - Imposición estricta de FORCE RLS activa en tablas de aplicación.
  - Membresía temporal del rol resolver revocada.
- **Gestión de Caché de Construcción npm:**
  - Uso exclusivo de `/opt/politica-canon/.npm-cache` (modo `0750`, propietario `politica-canon:politica-canon`).
  - Sin creación de directorio home interactivo ni alteración de permisos del sistema.
- **Resultados de Verificación Probes & Red:**
  - Servicio `politica-canon.service`: `active (running)`.
  - `/healthz`: HTTP 200 OK (`{"status":"ok"}`).
  - `/readyz`: HTTP 200 OK (`{"status":"ready"}` con PostgreSQL 16 y Redis 7 conectados).
  - Pasarela HTTPS (Nginx): HTTP 401 Unauthorized sin credenciales HTTP Basic.
  - Aislamiento de Red: Puertos `3000`, `5432` y `6379` enlazados exclusivamente a `127.0.0.1` / `::1`.
  - Integridad de Host: Sin instalación de Docker, sin cambios en Kernel, MariaDB ni Plesk.



