# MANUAL DE DESPLIEGUE EN PRODUCCIÓN (RUNBOOK) — RELEASE v0.3.30
**Sistema:** Política Canon  
**Versión de Despliegue:** Candidate Release v0.3.30  
**Versión Operativa Actual:** v0.3.11  
**Línea Base Certificada Previa:** v0.3.17 (`ed74688`)  
**Motor de Base de Datos:** PostgreSQL 16+  
**Entorno de Despliegue:** Servidor Plesk Linux (Ubuntu Server)  

---

## 1. Alcance y Principios Operativos

Este documento contiene las instrucciones mecánicas, secuenciales e inalterables para ejecutar el despliegue del candidato inmutable `politica-canon-v0.3.30.zip` en el entorno de producción.

> [!WARNING]
> **REGLA DE ORO DE DESPLIEGUE:**
> No se iniciará ningún paso de este Runbook sin contar previamente con la **Autorización 3** firmada por el Comité de Gobernanza (ver `GOVERNANCE_APPROVAL_PACK_v0.3.30.md`).

---

## 2. Fase 0: Verificaciones Previas y Preflight

Antes de iniciar la ventana de mantenimiento, ejecute las siguientes verificaciones en el servidor Plesk:

### 2.1 Verificación de Integridad del Artefacto Canónico
Descargue o transfiera el artefacto a `/tmp` y verifique su hash SHA-256 exacto:

```bash
sha256sum /tmp/politica-canon-v0.3.30.zip
```
**Resultado exigido:**
`561dfad6fd15fd008a61467b560c6a3214a9a1b92fe8728f9703c4bc40cf1fd1`

### 2.2 Verificación de Variables de Entorno de Producción (`.env`)
Asegúrese de que el archivo `/var/www/vhosts/politica.canon/app/.env` contenga variables de cifrado independientes y seguras:

```ini
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATABASE_URL=postgresql://politica_canon_app:PASSWORD_APP_SECRET@127.0.0.1:5432/politica_canon
ADMIN_DATABASE_URL=postgresql://postgres:PASSWORD_ADMIN_SECRET@127.0.0.1:5432/politica_canon
EMAIL_WORKER_DATABASE_URL=postgresql://politica_canon_email_worker:PASSWORD_WORKER_SECRET@127.0.0.1:5432/politica_canon
REDIS_URL=redis://127.0.0.1:6379

SESSION_SECRET=<hash_64_caracteres_aleatorio_1>
MFA_MASTER_KEY=<hash_64_caracteres_aleatorio_2>
EMAIL_OUTBOX_ENCRYPTION_KEY=<hash_64_caracteres_aleatorio_3>

SMTP_HOST=127.0.0.1
SMTP_PORT=25
SMTP_USER=outbox@politica.canon
SMTP_PASS=PASSWORD_SMTP_SECRET
SMTP_SECURE=false
SMTP_FROM=no-reply@politica.canon
APP_BASE_URL=https://politica.canon
```

---

## 3. Fase 1: Respaldos de Seguridad y Punto de Restauración (RPO = 0)

### 3.1 Backup Físico de Base de Datos PostgreSQL 16
Como usuario `postgres` o administrador, ejecute la extracción completa en formato custom con blobs y metadatos:

```bash
pg_dump -h 127.0.0.1 -U postgres -d politica_canon -F c -b -v -f /var/backups/politica_canon_pre_v0.3.30.dump
```
Verifique la existencia y tamaño del archivo generado:
```bash
ls -lh /var/backups/politica_canon_pre_v0.3.30.dump
```

### 3.2 Backup del Código Operativo Actual
```bash
tar -czvf /var/backups/app_v0.3.11_backup.tar.gz -C /var/www/vhosts/politica.canon/ app
```

---

## 4. Fase 2: Parada de Servicios y Despliegue de Código

### 4.1 Parada Controlada de Servicios Systemd
Detenga el worker de correo y el monolito web:

```bash
sudo systemctl stop politica-canon-outbox-worker.service
sudo systemctl stop politica-canon.service
```

Verifique que ambos servicios se encuentren en estado `inactive (dead)`:
```bash
sudo systemctl status politica-canon.service politica-canon-outbox-worker.service
```

### 4.2 Descompresión y Limpieza del Árbol de Código
```bash
cd /var/www/vhosts/politica.canon/app
rm -rf dist/ RELEASE_FILES.json validate_*.cjs scripts/ db/ deploy/
unzip -o /tmp/politica-canon-v0.3.30.zip
```

### 4.3 Instalación de Dependencias y Compilación
```bash
npm ci --omit=dev
npm run build
```

---

## 5. Fase 3: Ejecución de Migraciones y Bootstrap de Seguridad PG16

Ejecute la secuencia estricta de 3 fases DDL/DML de producción:

### 5.1 Fase 1 (Pre-Bootstrap de Roles)
```bash
node scripts/bootstrap-pre.mjs
```
*Garantiza la existencia de roles `app_owner`, `app_user`, `audit_*`, `email_worker`, `token_resolver`, `politica_canon_app` y `politica_canon_email_worker` con privilegios acotados.*

### 5.2 Fase 2 (Migración DDL de Producción)
```bash
node scripts/migrate-production.mjs
```
*Aplica DDLs incrementales forward-only bajo `SET ROLE app_owner` con Advisory Lock 87850301.*

### 5.3 Fase 3 (Post-Bootstrap de Permisos y RLS)
```bash
node scripts/bootstrap-post.mjs
```
*Asigna propiedad de objetos a `app_owner`, impone RLS obligatorio, restringe `PUBLIC` y establece la matriz de mínimos privilegios DML en `email_outbox`.*

---

## 6. Fase 4: Verificación In-Situ y Arranque de Servicios

### 6.1 Ejecución del Validador Autónomo en Producción
```bash
node validate_v0.3.30.cjs
```
**Resultado exigido:** `PASS (7/7 CONTROLES SUPERADOS)` con exit code 0.

### 6.2 Arranque de Servicios Systemd
```bash
sudo systemctl start politica-canon.service
sudo systemctl start politica-canon-outbox-worker.service
```

### 6.3 Verificación de Sondeo HTTP `/readyz`
```bash
curl -f http://127.0.0.1:3000/readyz
```
**Respuesta esperada (HTTP 200 OK):**
```json
{
  "status": "ready",
  "database": "connected",
  "redis": "connected",
  "smtp": "connected"
}
```

---

## 7. Fase 5: Smoke Tests Post-Despliegue

Ejecute las siguientes verificaciones funcionales en caliente:

1. **Autenticación Web:** Acceda a `https://politica.canon/` y compruebe que la sesión establece la cookie `__Host-sid` (HttpOnly, Secure, SameSite=Lax).
2. **Invitación Outbox:** Cree una invitación desde la consola de administración y verifique en PostgreSQL que el mensaje ingresa en `email_outbox` con estado `PENDING` y token cifrado (`v1:enc:...`).
3. **Consumo Worker SMTP:** Verifique en los logs del worker (`journalctl -u politica-canon-outbox-worker.service -n 50`) que el mensaje cambia a `SENT` y que `payload.token` queda redactado a `[REDACTED]`.

---

## 8. Fase 6: Plan de Contingencia y Rollback Inmediato (RTO < 5 min)

Si se detecta cualquier anomalía crítica (ej. HTTP 500/503 persistente en `/readyz`, fallos en la migración DDL o errores RLS en logs):

### 8.1 Parada Inmediata de Servicios
```bash
sudo systemctl stop politica-canon-outbox-worker.service politica-canon.service
```

### 8.2 Restitución de Base de Datos desde Backup Físico
```bash
dropdb -h 127.0.0.1 -U postgres politica_canon
createdb -h 127.0.0.1 -U postgres politica_canon
pg_restore -h 127.0.0.1 -U postgres -d politica_canon -v /var/backups/politica_canon_pre_v0.3.30.dump
```

### 8.3 Restitución del Código Anterior (v0.3.11)
```bash
cd /var/www/vhosts/politica.canon/
rm -rf app/
tar -xzvf /var/backups/app_v0.3.11_backup.tar.gz
```

### 8.4 Re-Arranque de Servicios y Verificación
```bash
sudo systemctl start politica-canon.service politica-canon-outbox-worker.service
curl -f http://127.0.0.1:3000/readyz
```
