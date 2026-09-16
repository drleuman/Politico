# Matriz de Remediación Técnica y Auditoría — Política Canon v0.3.12

**Fecha:** 16 de septiembre de 2026  
**Release:** `v0.3.12` (Fase 1.1 — Identidad, Invitaciones, Usuarios, Sesiones y RBAC/ABAC)  
**Estado de Despliegue:** EM PAQUETADO PARA AUDITORÍA DE PREDESPLIEGUE (NO DESPLEGADO A PRODUCCIÓN)

---

## 1. Matriz de Requisitos y Remediación Técnica (Fase 1.1)

| ID | Requisito / Componente | Estado | Implementación / Remediación Técnica |
|---|---|---|---|
| **REQ-1.1-01** | Invitaciones Privadas de Un Solo Uso | **REMEDIADO / PASS** | Almacenamiento exclusivo del hash SHA-256 (`token_hash`) en `invitations`. Token aleatorio de 256 bits devuelto una única vez. Validación de expiración (`expires_at`) y no consumo (`consumed_at IS NULL`). Sin registro público. |
| **REQ-1.1-02** | Alta de Usuarios y Credenciales Argon2id | **REMEDIADO / PASS** | Creación de usuario condicionada a aceptación de invitación. Contraseñas hasheadas obligatoriamente con Argon2id (`m=65536, t=3, p=4`). Política de complejidad estricta y restablecimiento seguro mediante token hasheado de un solo uso. |
| **REQ-1.1-03** | Sesiones Persistidas y Rotación en PostgreSQL | **REMEDIADO / PASS** | Tabla `user_sessions` en PostgreSQL como fuente autoritativa. Rotación del token de sesión en inicio de sesión y elevación de privilegios. Expiración inactiva (30m) y absoluta (24h). Límite de 5 sesiones activas por usuario. Cookie `HttpOnly`, `Secure`, `SameSite=Lax`. |
| **REQ-1.1-04** | TOTP MFA y Regla de Frescura (<15 min) | **REMEDIADO / PASS** | Soporte TOTP (RFC 6238) con secreto cifrado en reposo (`AES-256-GCM`) en `users.mfa_secret_encrypted`. 10 códigos de respaldo de un solo uso en `mfa_backup_codes`. Campo `mfa_verified_at` en sesión exigido para acciones de gobernanza sensibles (frescura <= 15 min / 900s). |
| **REQ-1.1-05** | RBAC/ABAC Persistido y Servidor-Centric | **REMEDIADO / PASS** | `role_assignments` como fuente de verdad unificada. Evaluación de validez temporal (`valid_from`, `valid_until`), membresía activa y contexto del recurso en `evaluateAuthorizationContract()`. Denegación incondicional de `ADMIN` para aprobar/publicar y prevención de conflicto de interés en autores. |
| **REQ-1.1-06** | Auditoría Integrada en Audit Outbox | **REMEDIADO / PASS** | Registro atómico de eventos de seguridad (`INVITATION_CREATED`, `INVITATION_ACCEPTED`, `USER_REGISTERED`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `LOGOUT_ALL`, `PASSWORD_RESET_*`, `MFA_*`, `ROLE_ASSIGNED`) en `audit_outbox`. Sanitización estricta sin secretos ni contraseñas. |
| **REQ-1.1-07** | Migración Incremental 0003 y Permisos RLS | **REMEDIADO / PASS** | Migración incremental DDL `db/migrations/0003_fase_1_1_identity_rbac.sql` ejecutada por `app_owner`. Actualización de `0002_bootstrap_permissions.sql` con concesiones DML mínimas e imposición estricta de RLS para el rol runtime `politica_canon_app` (`NOSUPERUSER`, `NOBYPASSRLS`). |
| **REQ-1.1-08** | Suite de Pruebas de Integración PostgreSQL 16 + Redis 7 | **REMEDIADO / PASS** | `scripts/test-integration-pg16.mjs` ampliado para validar en contenedores reales PostgreSQL 16 y Redis 7 el ciclo completo de invitaciones, login Argon2id, expiración de sesión, TOTP step-up, revocación y aislamiento multi-tenant. |

---

## 2. Invariantes de Seguridad Verificados

1. **Fail-Closed Ante Ausencia de Configuración**: La aplicación aborta si faltan `DATABASE_URL`, `REDIS_URL` o `SESSION_SECRET`.
2. **Protección Criptográfica en Reposo**: Ninguna contraseña, secreto TOTP o token se guarda en texto claro en la base de datos o en los logs estructurados.
3. **Denegación de Acceso Anónimo y Cross-Tenant**: Se bloquea cualquier interacción privada que no pertenezca a la organización activa del usuario autenticado.
4. **Cero Despliegue Prematuro**: El release queda congelado y empaquetado a la espera de autorización explícita para la Fase 1.2.
