# Informe de Validación Técnica y Auditoría Estática — Release v0.3.18

**Fecha de Generación:** 17 de septiembre de 2026  
**Rama Target:** `feature/fase-1.1-functional`  
**Versión Evaluada:** `v0.3.18`  
**Dictamen General:** **PASS — FASE 1.1 FUNCIONAL CERTIFICADA 100%**

---

## Resumen de Comprobaciones Estáticas (7/7 PASS)

1. **Enlaces Relativos Portables Markdown:** **PASS** (Todos los enlaces verificados sin esquemas `file://`).
2. **Preservación Criptográfica de Informes Históricos:** **PASS** (Normalización CRLF/LF aplicada).
3. **Compilación TypeScript Estricta:** **PASS** (`npx tsc --noEmit` sin errores).
4. **Coherencia de Metadatos de Release v0.3.18:** **PASS** (`package.json`, `src/server.ts`, `scripts/migrate-production.mjs`, `scripts/test-integration-pg16.mjs`, `deploy/systemd/politica-canon.service`, `deploy/plesk/vhost_nginx.conf`, `public/index.html`, `CHANGELOG.md`).
5. **Modelo de Permisos Restringido 0750 / 0640 y Grupo:** **PASS** (`deploy/scripts/provision.sh`).
6. **Inicialización Basal PGlite y Migraciones 0001 a 0005:** **PASS** (Resolvers asignados a `token_resolver`, denegación DML verificada en `app_user`).
7. **Inclusión Directa de Integración Real en npm test:** **PASS** (`package.json`).

---

## Verificación de Integración Real (PostgreSQL 16 & Redis 7)

- **Fail-Closed de Email Transport:** Verificado que la emisión de invitaciones sin servidor de correo configurado devuelve HTTP 503 sin exponer el token.
- **Flujo de Invitación & Aceptación:** Entrega segura vía adaptador de email, creación de cuenta con credenciales Argon2id y prevención estricta de reutilización (HTTP 400).
- **Separación de Clave MFA:** Cifrado de secretos TOTP con `MFA_MASTER_KEY` independiente.
- **Gestión de Sesiones y Usuarios:** Endpoints `GET /api/v1/sessions`, `DELETE /api/v1/sessions/:id`, `GET /api/v1/users`, `PATCH /api/v1/users/:id/status` verificados con RLS, Anti-CSRF y RBAC/ABAC.
- **Producción:** Continúa intacta en **v0.3.11**.
