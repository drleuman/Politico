# Matriz de Remediación Técnica — Release Candidate v0.3.20

**Fecha de Emisión:** 17 de septiembre de 2026  
**Rama Git:** `release/v0.3.20-candidate`  
**Baseline Certificado Previo:** Tag `v0.3.17` (commit `ed74688`) / Ejecución Productiva `v0.3.11`  
**Dictamen de Remediación:** PASS  

---

## Resumen de Remediaciones Aplicadas

| ID | Severidad | Descripción del Hallazgo | Estrategia de Remediación | Archivos Modificados | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | Crítica | Aislamiento RLS transaccional roto al ejecutar `set_config` fuera de bloques `BEGIN...COMMIT` explícitos. | Envoltura transaccional explícita (`BEGIN ... COMMIT/ROLLBACK`) en cada operación de base de datos tenant-aware (`session.ts`, `invitations.ts`, `routes.ts`, `events.ts`). | `src/auth/session.ts`, `src/auth/invitations.ts`, `src/auth/routes.ts` | **PASS** |
| **C-02** | Crítica | Uso de columnas inexistentes `om.role` y `updated_at` en `PATCH /api/v1/users/:id/status`. | Consulta de rol desde `role_assignments` y actualización exclusiva de la columna existente `is_active` en `organization_memberships`. | `src/auth/routes.ts` | **PASS** |
| **C-03** | Crítica | Compensación SMTP no atómica y registro de auditoría huérfano ante fallo de envío. | Control transaccional unificado: si `sendInvitationEmail()` o `sendPasswordResetEmail()` fallan, se ejecuta `ROLLBACK` revirtiendo invitación/token Y auditoría atómicamente. | `src/auth/routes.ts`, `src/auth/invitations.ts` | **PASS** |
| **C-04** | Crítica | Runner de integración desacoplado y sin cobertura real de SMTP ni MFA. | Integración de servicio SMTP Mailpit en `docker-compose.audit.yml` y suite completa de pruebas adversariales MFA, rate-limiting, RLS pool y rollback SMTP. | `docker-compose.audit.yml`, `scripts/test-integration-pg16.mjs` | **PASS** |
| **H-01** | Alta | Validador estático aceptaba 0 verificaciones históricas sin cotejar el manifiesto JSON. | Parseo estricto del archivo `MANIFEST_v0.3.20.json` con validación de versión, SHA-256 y denegación de dictamen PASS si no coincide. | `validate_v0.3.20.cjs` | **PASS** |
| **H-02** | Alta | Aceptación de la cookie heredada `sid` en `extractSessionToken()`. | Retirada completa de la lectura de la cookie `sid`; autenticación basada exclusivamente en la cookie HttpOnly `__Host-sid`. | `src/auth/routes.ts` | **PASS** |
| **H-03** | Alta | Script de rollback 0005 no restauraba las políticas RLS modificadas. | Actualización del script `0005_fase_1_1_functional_down.sql` con la eliminación limpia de políticas e índices creados. | `db/migrations/0005_fase_1_1_functional_down.sql` | **PASS** |
| **H-04** | Alta | Escritura de archivo de entorno temporal sin umask restrictivo previo. | Uso explícito de `umask 0077` y establecimiento de modo 0640 en `provision.sh` antes del volcado de secretos. | `deploy/scripts/provision.sh` | **PASS** |
