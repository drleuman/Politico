# ADR-0002 — Gestión de Sesiones, Protecciones CSRF y Recuperación MFA — Política Canon v0.2.18

**Estado:** `ACEPTADO (RATIFICACIÓN HUMANA)`  
**Fecha de Propuesta:** 2026-09-16  
**Fecha de Ratificación:** 2026-09-15  
**Paquete:** `politica-canon-v0.2.18`  
**Responsables:** Arquitectura Técnica / Órgano Promotor Humano  

---

## 1. Contexto

Se requiere definir la estrategia de sesión, revocación en tiempo real, resistencia CSRF e identidad segura para la plataforma colaborativa de investigación y gobernanza.

---

## 2. Decisiones

1. **Tienda Autoritativa Única en Redis (Fail-Closed):**
   - **Redis** con AOF es la fuente autoritativa primaria de sesión. Si Redis cae, la API **falla cerrado (`503 Service Unavailable`)**.
   - En PostgreSQL, la tabla `user_sessions` almacena las sesiones asociadas a `organization_id` para auditoría e inspección de actividad.

2. **Revocación Indexada por Usuario:**
   - Cada inicio de sesión añade la clave al conjunto `user_sessions:<user_id>` en Redis, permitiendo la revocación instantánea sin búsquedas salvajes `KEYS session:*`.

3. **Synchronizer Token Pattern Anti-CSRF:**
   - La cookie `sid` transita con `HttpOnly: true`, `Secure: true`, `SameSite: Strict`, `Path: /api/v1`.
   - Las solicitudes mutativas exigen la cabecera `X-CSRF-Token` emparejada con el token sincronizador guardado en la sesión de Redis.

4. **Códigos de Respaldo MFA y Cifrado de Secretos:**
   - Al activar TOTP se generan 8 códigos de respaldo guardados en `mfa_backup_codes` con **hash lento Argon2id**.
   - El secreto TOTP (`mfa_secret`) en `users` se cifra mediante **Envelope Encryption (AES-256-GCM)**.
   - La antigüedad de verificación TOTP exige validación finitica (`Number.isFinite(age)`, `0 <= age && age <= 900` segundos / 15 minutos).
