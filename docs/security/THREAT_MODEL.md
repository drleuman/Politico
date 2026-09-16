# Modelo de Amenazas (STRIDE) y Análisis de Riesgos — Política Canon v0.2.18

**Estado:** `VIGENTE (RATIFICACIÓN HUMANA)`  
**Fecha:** 2026-09-16  
**Paquete:** `politica-canon-v0.2.18`  

---

## 1. Análisis STRIDE Ampliado (12 Vectores de Amenaza)

| Vector de Amenaza | Categoría STRIDE | Descripción de Riesgo | Controles de Mitigación Planificados (Fase 1) | Riesgo Residual |
|---|---|---|---|---|
| **Falsificación de Identidad** | *Spoofing* | Intercepción de cookies o compromiso de contraseñas. | Cookies `HttpOnly`, `Secure`, `SameSite=Strict`, sesiones opacas en Redis, TOTP MFA para gobernanza. | Bajo |
| **Compromiso de Invitaciones** | *Spoofing* | Intercepción de enlaces de invitación o recuperación. | Tokens de un solo uso de alta entropía almacenados en `invitations` mediante hash SHA-256 con expiración de 24h. | Bajo |
| **Tampering de Borradores** | *Tampering* | Modificación no autorizada de borradores en revisión. | Control Optimista de Concurrencia (OCC) con `revision_number`, congelamiento en `document_versions` con `content_hash`. | Bajo |
| **Tampering por Borrado Cascading** | *Tampering* | Eliminación de registros inmutables por borrado en cascada. | Eliminación de `ON DELETE CASCADE` en entidades inmutables (`ON DELETE RESTRICT`) y disparador SQL anti-CASCADE. | Muy Bajo |
| **Repudio de Acciones** | *Repudiation* | Alteración o borrado de registros de auditoría. | Auditoría append-only con `sequence_number` por org, Genesis Hash (64 ceros), hash chain y trigger `prevent_modification_or_deletion()`. | Muy Bajo |
| **Replay de Outbox Worker** | *Repudiation / Tampering* | Duplicación de eventos de auditoría por reintentos de trabajador. | Clave `outbox_id UUID NOT NULL UNIQUE` en `audit_events` garantizando idempotencia estricta en el worker. | Muy Bajo |
| **Exfiltración Multi-tenant** | *Information Disclosure* | Salto de ámbito entre organizaciones o workspaces. | Claves compuestas `organization_id` en DDL + Row-Level Security (RLS) en 25 tablas tenant-scoped + Contrato TypeScript. | Muy Bajo |
| **Compromiso de Clave KMS / TOTP** | *Information Disclosure* | Lectura de secretos TOTP desprotegidos en base de datos. | Cifrado en reposo mediante Envelope Encryption (AES-256-GCM) con claves maestras administradas fuera del código. | Bajo |
| **Abuso de Servicios PDF / SSRF** | *Denial of Service / SSRF* | Inyección de scripts o consumo de recursos en impresión. | Contenedor Chromium aislado (`--net=none`, usuario `node`, IPC/tmpfs, flags locales bloqueados). | Bajo |
| **Elevación de Privilegios Admin** | *Elevation of Privilege* | Admin técnico intentando aprobar normas o publicar. | Denegación Incondicional del Admin para `APPROVE_DECISION` y `PUBLISH` en el evaluador de autorización. | Muy Bajo |
| **Colusión de Aprobadores de Rol** | *Elevation of Privilege* | Intento de autoasignación o auto-aprobación de roles. | Doble Control transaccional en servidor (`grant_governance_role_transactional`) con 4 identidades distintas y `GOVERNANCE_REGISTRY`. | Bajo |
| **Insiders DBA / Plesk** | *Elevation of Privilege* | Modificación directa por usuarios con acceso directo a base de datos. | Triggers SQL de inmutabilidad, firma hash chain criptográfica y copias de seguridad out-of-band cifradas. | Medio |

---

## 2. Aislamiento y Sandbox del Renderizador Headless Chromium (SSRF / LFI Prevention)

Para prevenir ataques de SSRF, exfiltración de archivos locales mediante el protocolo `file://` o consumo agotador de memoria, la impresión de documentos (`PDF`, `HTML`) se ejecuta mediante un **contenedor Docker efímero aislado con tubería STDIN/STDOUT**:

```bash
docker run --rm -i \
  --net=none \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --user node \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  --pids-limit=100 \
  --memory=512m \
  --cpus=1.0 \
  pdf-renderer-service:v1.0.0 \
  node render.js < sanitized_ast.json > output.pdf
```

### Reglas de Canal y Banderas Verificadas de Chromium:
1. **Canal STDIN/STDOUT:** El servidor entrega el AST HTML sanitizado vía STDIN y recibe el binario impreso por STDOUT sin montar volúmenes persistentes.
2. **Banderas de Aislamiento de Chromium:**
   - `--no-sandbox --disable-setuid-sandbox`
   - `--disable-dev-shm-usage --disable-gpu --disable-software-rasterizer`
   - `--disable-remote-fonts`
   - `--disable-local-file-access --allow-file-access-from-files=false`
   - `--block-new-web-contents --deny-permission-prompts`
3. **Límites de Ejecución y Timeout:** Timeout estricto de 10 segundos controlado por Node.js y límite de tamaño de salida de 10 MB.
4. **Formatos Alternativos:** Los formatos `DOCX` y `EPUB` se generan mediante librerías nativas dedicadas en Node.js de forma aislada sin invocar Chromium.
