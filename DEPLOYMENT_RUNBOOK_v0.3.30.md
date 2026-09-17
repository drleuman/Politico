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
> No se iniciará ningún paso de este Runbook sin contar previamente con la **Autorización 3** firmada por el Comité de Gobernanza y la verificación positiva del 100% de la Checklist **GO / NO-GO**.

---

## 2. Matriz de Evaluación GO / NO-GO (Pre-Requisito Obligatorio)

Antes de detener servicios o tocar la base de datos de producción, el equipo de operaciones y el release manager deben validar la siguiente matriz:

```text
EVALUACIÓN GO / NO-GO (GATE 3):

[ ] 1. HASH ARTEFACTO: SHA-256 de /tmp/politica-canon-v0.3.30.zip = 561dfad6fd15fd008a61467b560c6a3214a9a1b92fe8728f9703c4bc40cf1fd1
[ ] 2. INTEGRIDAD BACKUP: Backup físico pg_dump verificado y confirmado como restaurable.
[ ] 3. RPO / RTO DEFINIDOS: RPO (corte de escrituras) y RTO Target (<15 min) aceptados por operaciones.
[ ] 4. SECRETOS INDEPENDIENTES: validateConfig() aprueba la independencia de SESSION_SECRET, MFA_MASTER_KEY y EMAIL_OUTBOX_ENCRYPTION_KEY.
[ ] 5. ENTORNO ENGINE: Node.js v20+ / npm v10+ y PostgreSQL 16+ confirmados en el servidor Plesk.
[ ] 6. ALMACENAMIENTO: Espacio libre > 5 GB en /var/backups y /var/www.
[ ] 7. MIGRACIONES CONOCIDAS: Secuencia DDL 0001..0005 revisada.
[ ] 8. PUNTO DE NO RETORNO: Protocolo de Rollback e identificación del Punto de No Retorno entendidos por el equipo.
[ ] 9. RESPONSABLES PRESENTES: Release Manager, DB Admin y SysAdmin presentes en la ventana.
[ ] 10. VENTANA ABIERTA: Ventana de mantenimiento formalmente abierta y comunicada.

CUALQUIER INCUMPLIMIENTO EN LOS PUNTOS 1 AL 10 => DECISIÓN NO-GO (ABORTAR SIN TOCAR SERVICIOS NI BD).
```

---

## 3. Definición Realista de RPO y RTO

### 3.1 Objetivo de Punto de Recuperación (RPO Real)
- **Definición:** **Backup Consistente Pre-Despliegue con Ventana de Escritura Congelada.**
- **Mecanismo:** La parada de servicios (`systemctl stop politica-canon`) antes de ejecutar el backup o las migraciones detiene el procesamiento de solicitudes HTTP/API y la ingesta de transacciones en la BD.
- **Garantía:** Cero pérdida de datos (RPO = 0) respecto a transacciones confirmadas antes del cierre de la ventana de escrituras. Solicitudes entrantes durante el mantenimiento reciben 503 Service Unavailable a nivel de proxy/Nginx.

### 3.2 Objetivo de Tiempo de Recuperación (RTO Target)
- **RTO Objetivo:** **< 15 minutos** (Sujeto a tamaño físico de la base de datos y tiempo de restauración del dump).
- **Punto de No Retorno (Point of No Return):**
  > [!CAUTION]
  > Una vez completados los Smoke Tests de la Fase 5 y restablecido el tráfico público a la aplicación, **el restore del backup `pg_dump` DEJA DE SER UN MECANISMO VÁLIDO DE ROLLBACK**, ya que destruiría transacciones reales creadas por usuarios tras la reapertura. Anomalías posteriores a este punto deberán remediarse mediante hotfix forward-only o desactivación selectiva de funcionalidades.

---

## 4. Fase 0: Verificaciones Previas y Preflight

### 4.1 Verificación Criptográfica del Artefacto Canónico
Descargue o transfiera el artefacto a `/tmp` y verifique su hash SHA-256 exacto:

```bash
sha256sum /tmp/politica-canon-v0.3.30.zip
```
**Resultado exigido:** `561dfad6fd15fd008a61467b560c6a3214a9a1b92fe8728f9703c4bc40cf1fd1`

### 4.2 Verificación de Variables de Entorno de Producción (`.env`)
Asegúrese de que `/var/www/vhosts/politica.canon/app/.env` contenga variables independientes:

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

SMTP_HOST=smtp.proveedor-productivo.com
SMTP_PORT=587
SMTP_USER=no-reply@politica.canon
SMTP_PASS=PASSWORD_SMTP_PROD_SECRET
SMTP_SECURE=false
SMTP_FROM=no-reply@politica.canon
APP_BASE_URL=https://politica.canon
```

---

## 5. Fase 1: Respaldos de Seguridad y Consistencia

### 5.1 Parada Inicial de Servicios (Congelación de Escrituras)
Detenga los servicios antes de extraer el backup para garantizar consistencia absoluta:

```bash
sudo systemctl stop politica-canon-outbox-worker.service
sudo systemctl stop politica-canon.service
```

### 5.2 Backup Físico de Base de Datos PostgreSQL 16
Como usuario `postgres` o administrador DB:

```bash
pg_dump -h 127.0.0.1 -U postgres -d politica_canon -F c -b -v -f /var/backups/politica_canon_pre_v0.3.30.dump
```
Verifique la existencia y tamaño del archivo generado:
```bash
ls -lh /var/backups/politica_canon_pre_v0.3.30.dump
```

### 5.3 Backup del Código Operativo Actual (v0.3.11)
```bash
tar -czvf /var/backups/app_v0.3.11_backup.tar.gz -C /var/www/vhosts/politica.canon/ app
```

---

## 6. Fase 2: Despliegue de Código e Instalación de Dependencias

### 6.1 Descompresión del Artefacto v0.3.30
```bash
cd /var/www/vhosts/politica.canon/app
rm -rf dist/ RELEASE_FILES.json validate_*.cjs scripts/ db/ deploy/
unzip -o /tmp/politica-canon-v0.3.30.zip
```

### 6.2 Instalación de Dependencias y Secuencia de Build

El artefacto `politica-canon-v0.3.30.zip` **ya contiene el directorio pre-compilado `dist/` en su interior**. Por ello, el procedimiento primario recomendado en producción evita requerir herramientas de compilación (`devDependencies`) durante la instalación:

#### OPCIÓN A (Recomendada — Uso de `dist/` pre-compilado en el ZIP):
```bash
npm ci --omit=dev
```
*No requiere ejecutar `npm run build` pues el paquete certificado incluye `dist/`.*

#### OPCIÓN B (Alternativa — Recompilación explícita en servidor):
Si por política interna se exige recompilar el TypeScript en el servidor de destino:
```bash
npm ci
npm run build
npm prune --omit=dev
```

---

## 7. Fase 3: Ejecución de Migraciones y Bootstrap de Seguridad PG16

Ejecute la secuencia estricta de 3 fases DDL/DML de producción:

### 7.1 Fase 1 (Pre-Bootstrap de Roles)
```bash
node scripts/bootstrap-pre.mjs
```
*Garantiza la existencia de roles `app_owner`, `app_user`, `audit_*`, `email_worker`, `token_resolver`, `politica_canon_app` y `politica_canon_email_worker` con privilegios acotados.*

### 7.2 Fase 2 (Migración DDL de Producción)
```bash
node scripts/migrate-production.mjs
```
*Aplica DDLs incrementales forward-only bajo `SET ROLE app_owner` con Advisory Lock 87850301.*

### 7.3 Fase 3 (Post-Bootstrap de Permisos y RLS)
```bash
node scripts/bootstrap-post.mjs
```
*Asigna propiedad de objetos a `app_owner`, impone RLS obligatorio, restringe `PUBLIC` y establece la matriz de mínimos privilegios DML en `email_outbox`.*

---

## 8. Fase 4: Verificación In-Situ y Arranque de Servicios

### 8.1 Ejecución del Validador Autónomo en Producción
```bash
node validate_v0.3.30.cjs
```
**Resultado exigido:** `PASS (7/7 CONTROLES SUPERADOS)` con exit code 0.

### 8.2 Arranque de Servicios Systemd
```bash
sudo systemctl start politica-canon.service
sudo systemctl start politica-canon-outbox-worker.service
```

### 8.3 Verificación de Sondeo HTTP `/readyz`
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

## 9. Fase 5: Smoke Tests de Producción (Transporte SMTP Real vs. Mailpit)

> [!NOTE]
> **Diferenciación de Entornos de Transporte:**
> - **Pruebas de Integración (`npm test`):** Utilizan Mailpit SMTP en los puertos localizados 11025 / 18025.
> - **Smoke Test de Producción:** Utiliza el servidor SMTP productivo real configurado en `.env` (puertos 25/587/465).

### 9.1 Verificación de Conexión SMTP de Producción
El endpoint `/readyz` invoca automáticamente `verifyEmailTransport()`, el cual ejecuta `transporter.verify()` contra el servidor SMTP de producción. Un resultado `"smtp": "connected"` en `/readyz` confirma la autenticación y conectividad TLS/STARTTLS sin enviar mensajes a usuarios.

### 9.2 Prueba Controlada de Encolado y Procesamiento SMTP
Si se requiere probar la transmisión de un correo de prueba:
1. Encole un mensaje de prueba hacia una dirección interna de control (ej. `smtp-smoke-test@politica.canon`).
2. Verifique en los logs del worker (`journalctl -u politica-canon-outbox-worker.service -n 50`) que el mensaje fue transmitido exitosamente y que `payload.token` fue redactado a `[REDACTED]`.

---

## 10. Fase 6: Protocolo de Rollback Inmediato (Pre-Punto de No Retorno)

Si durante las Fases 3, 4 o 5 se detecta una falla crítica **antes de declarar la reapertura pública de tráfico**:

### 10.1 Parada Inmediata de Servicios
```bash
sudo systemctl stop politica-canon-outbox-worker.service politica-canon.service
```

### 10.2 Restitución de Base de Datos desde Backup Físico
```bash
dropdb -h 127.0.0.1 -U postgres politica_canon
createdb -h 127.0.0.1 -U postgres politica_canon
pg_restore -h 127.0.0.1 -U postgres -d politica_canon -v /var/backups/politica_canon_pre_v0.3.30.dump
```

### 10.3 Restitución del Código Anterior (v0.3.11)
```bash
cd /var/www/vhosts/politica.canon/
rm -rf app/
tar -xzvf /var/backups/app_v0.3.11_backup.tar.gz
```

### 10.4 Re-Arranque de Servicios y Verificación
```bash
sudo systemctl start politica-canon.service politica-canon-outbox-worker.service
curl -f http://127.0.0.1:3000/readyz
```
