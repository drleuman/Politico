# Canon Institucional y Reglas Fundacionales — Política Canon v0.2.8

**Estado:** `VIGENTE (RATIFICACIÓN HUMANA)`  
**Fecha:** 2026-09-15  
**Paquete:** `politica-canon-v0.2.8`  

---

## 1. Principios Canónicos Indispensables

1. **Separación Estricta e Incondicional de Funciones:** El rol `ADMIN` técnico no posee facultades para aprobar resoluciones normativas ni publicar contenidos institucionales (Denegación Incondicional).
2. **Default-Deny y Contexto Causal:** Toda acción exige verificación de organización activa, workspace, rol, especialidad, estado documental y MFA.
3. **Fuente Única de Asignación de Roles:** Todos los roles del sistema se derivan autoritativamente de la tabla `role_assignments` especificando `scope_type` (`ORGANIZATION`, `WORKSPACE`, `AUTHORITY_BODY`), `scope_id` y vigencia temporal.
4. **Congelamiento Causal Inmutable:** Ninguna revisión ni aprobación puede ejecutarse sobre un borrador mutable. Se congela la versión en `document_versions` antes de dictaminar.
5. **Dictámenes y Eventos Inmutables:** Dictámenes de revisión son inmutables (`ACCEPTED` o `REJECTED`). Invalidaciones o retiros se registran mediante eventos append-only en `publication_events` o `document_invalidations`.
6. **Doble Control Registrado en Servidor:** Otorgar roles de gobernanza exige 2 aprobaciones de miembros activos de `GOVERNANCE_REGISTRY` verificadas en el servidor mediante el procedimiento transaccional `grant_governance_role_transactional(p_organization_id, p_request_id)`.
7. **Defensa Multi-tenant en Base de Datos:** Aislamiento mediante claves compuestas `organization_id` y **Row-Level Security (RLS)** en PostgreSQL en las 25 tablas tenant-scoped con políticas explícitas `USING` y `WITH CHECK`.
8. **Auditoría Transactional Outbox & Criptografía:** Registro monotónico por `sequence_number`, Genesis Hash de 64 ceros, firma criptográfica hash chain RFC 8785 (JCS) e idempotencia via `outbox_id UNIQUE` y worker `FOR UPDATE SKIP LOCKED` (`src/audit/worker.ts`).
9. **Motorización de Base de Datos:** La única motorización ratificada es **PostgreSQL 16+**. No se admite MySQL ni MariaDB. Plesk administrará PostgreSQL mediante su extensión oficial o contenedor Docker supervisado.
