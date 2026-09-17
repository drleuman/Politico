# Matriz de Remediación Técnica — Release Candidate v0.3.21

**Fecha:** 17 de septiembre de 2026  
**Rama Git:** `release/v0.3.21-candidate`  
**Línea Base Git Certificada:** Tag `v0.3.17` (commit `ed74688`)  
**Instancia Productiva (Servidor Live):** Versión `v0.3.11` (Plesk / Ubuntu 24.04)  
**Dictamen de Auditoría Previa (v0.3.20):** `FAIL` — Remediación completa en `v0.3.21`

---

## 1. Resumen de Remediación Técnica

| ID Hallazgo | Severidad | Descripción del Defecto | Remediación Implementada en v0.3.21 | Archivos Modificados | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | Crítica | El límite transaccional RLS perdía el GUC del tenant al finalizar `validateSession()` antes de `buildResolvedAuthorizationContext()`. | Se envolvió cada operación HTTP en un contrato transaccional único `BEGIN ... COMMIT / ROLLBACK` en `src/auth/routes.ts` y se removieron los `COMMIT` autónomos de `validateSession()` y `createSession()`. | `src/auth/session.ts`, `src/auth/routes.ts` | **PASS** |
| **C-02** | Crítica | `PATCH /api/v1/users/:id/status` usaba columnas inexistentes `om.role` y `updated_at`. | Se modificó la consulta para obtener roles desde `role_assignments` y se actualizó `organization_memberships` usando sólo columnas reales (`is_active`). | `src/auth/routes.ts` | **PASS** |
| **C-03** | Crítica | Emisión de invitaciones y recuperación de contraseña no eran atómicas respecto a la base de datos, correo y auditoría, usando `DELETE` compensatorios frágiles. | Se integró el envío de correo dentro del bloque transaccional de base de datos. Ante fallo en el transporte de correo, se ejecuta `ROLLBACK` total, eliminando atómicamente el registro y el evento de auditoría outbox sin dejar huérfanos. | `src/auth/routes.ts`, `src/auth/invitations.ts` | **PASS** |
| **C-04** | Crítica | Runner de pruebas enmascaraba el uso de SMTP con almacén en memoria y omitía cobertura de endpoints MFA E2E. | Se configuró el runner `scripts/test-integration-pg16.mjs` para realizar envíos SMTP reales a Mailpit (puerto 11025) y consultar su API REST (puerto 18025), además de probar el ciclo E2E completo de MFA. | `src/email/adapter.ts`, `scripts/test-integration-pg16.mjs` | **PASS** |
| **H-01** | Alta | La cookie heredada `sid` continuaba aceptándose en `extractSessionToken()`. | Se modificó `extractSessionToken()` para leer exclusivamente la cookie HttpOnly `__Host-sid` y se añadió una prueba negativa HTTP 401 en el runner. | `src/auth/routes.ts`, `scripts/test-integration-pg16.mjs` | **PASS** |
| **H-02** | Alta | El script `0005_fase_1_1_functional_down.sql` no restauraba las políticas RLS previas. | Se actualizó `0005_down.sql` para eliminar y recrear explícitamente las políticas RLS anteriores en las 4 tablas afectadas y remover los índices. | `db/migrations/0005_fase_1_1_functional_down.sql` | **PASS** |
| **H-03** | Alta | El validador estático no verificaba la integridad física del paquete ZIP entregado ni su hash SHA-256 contra el manifiesto. | Se creó `validate_v0.3.21.cjs` con lectura y cálculo físico del hash SHA-256, tamaño de bytes y recuento de inventario de `politica-canon-v0.3.21.zip`. | `validate_v0.3.21.cjs` | **PASS** |
| **H-04** | Alta | Incoherencia en documentación sobre la versión desplegada en producción. | Se reconcilió la documentación formalizando que la producción en servidor live está en `v0.3.11`, la línea base Git certificada en `v0.3.17`, y el candidato actual en `v0.3.21`. | `VALIDATION_REPORT_v0.3.21.md`, `DEPLOYMENT_REPORT.md` | **PASS** |
| **M-01** | Media | Metadatos y banners incoherentes en `deploy/scripts/provision.sh`. | Se actualizaron todos los encabezados, banners y comentarios de `provision.sh` a la versión `v0.3.21`. | `deploy/scripts/provision.sh` | **PASS** |
| **M-02** | Media | El validador estático no comprobaba las invariantes de ejecución. | Se fortaleció `validate_v0.3.21.cjs` con PGlite, inspección AST de código fuente y aserciones estrictas de 7/7 controles. | `validate_v0.3.21.cjs` | **PASS** |

---

## 2. Declaración de Cumplimiento de Gobernanza

1. **Sin Merge no autorizado:** La rama `release/v0.3.21-candidate` permanece aislada sin fusionarse a `main`.
2. **Sin Tag Git no autorizado:** No se ha creado el tag Git `v0.3.21`.
3. **Sin Despliegue en Producción:** El servidor de producción permanece en `v0.3.11` sano y operativo.
4. **Próximo Paso:** Remediación empaquetada en `politica-canon-v0.3.21.zip` con manifiesto `MANIFEST_v0.3.21.json` para auditoría independiente.
