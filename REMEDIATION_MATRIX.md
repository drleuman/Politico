# Matriz de Remediación de Auditoría — Paquete v0.2.1

**Estado:** `EN AUDITORÍA EXTERNA`  
**Fecha:** 2026-09-15  
**Paquete Auditado Previamente:** `politica-canon-v0.2.0.zip` (`NO PASS`)  
**Paquete Remediado:** `politica-canon-v0.2.1.zip`  

---

## 1. Tabla de Trazabilidad y Cierre de Bloqueos Críticos (B-01 a B-08)

| ID Hallazgo | Descripción del Bloqueo | Archivo Modificado | Sección / Ubicación | Prueba de Cierre / Remediación Aplicada |
|---|---|---|---|---|
| **B-01** | Incoherencia de ratificación documental y estados mixtos | [`docs/00_INDICE_CANONICO_DOCUMENTAL.md`](docs/00_INDICE_CANONICO_DOCUMENTAL.md), [`README.md`](README.md), [`docs/00_ACTA_FUNDACIONAL.md`](docs/00_ACTA_FUNDACIONAL.md), [`docs/01_PRD.md`](docs/01_PRD.md), [`docs/backlog/PHASE_1_BACKLOG.md`](docs/backlog/PHASE_1_BACKLOG.md) | Todo el archivo | Creada la Tabla Maestra de Documentos con versión `0.2.1`, estados unificados (`VIGENTE`, `RATIFICADO`, `BLOQUEADO`) y `PHASE_1_BACKLOG.md` marcado formalmente como `BLOQUEADO`. |
| **B-02** | El canon base contradice la separación estricta del Admin | [`docs/03_ROLES_Y_PERMISOS.md`](docs/03_ROLES_Y_PERMISOS.md), [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md), [`docs/audits/PHASE_0_GAP_ANALYSIS.md`](docs/audits/PHASE_0_GAP_ANALYSIS.md) | Sección 2, Matriz Base de Permisos | Eliminado `✓*` de `Admin` en aprobación/publicación en `03_ROLES_Y_PERMISOS.md`. Declaradas prohibiciones explícitas `NEVER` y restringido el acceso de emergencia a `EMERGENCY_UNPUBLISH`. |
| **B-03** | Flujo de aprobación invertía el orden de congelamiento | [`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md), [`CANON.md`](CANON.md), [`docs/product/SCREEN_AND_FLOW_MAP.md`](docs/product/SCREEN_AND_FLOW_MAP.md) | Sección 1 y 2, Flujo 2 y 3 | Separado `WorkingDraft` (mutable) de `DocumentVersion` (inmutable). Al enviar a revisión se congela la versión y se calcula el `content_hash` SHA-256 BEFORE revisiones. Revisiones y aprobación firman sobre el hash exacto. |
| **B-04** | Modelo de autorización permitía salto de ámbito y autoescalado | [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md) | Sección 4, `evaluateAuthorizationContract` | Eliminado pseudocódigo inseguro. Creado contrato formal que evalúa `organization_id`, `workspace_id`, `resource`, `action`, `state`, `classification`, `conflicts`, `mfa_verified` con política *deny-overrides*. Prohibida la autoasignación de roles y auto-aprobación. |
| **B-05** | ERD no garantizaba aislamiento organizativo ni definía tablas | [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Sección 1, 2 y 3 | Rediseñado el ERD a 25 entidades conceptuales (13 tablas físicas DDL de Fase 1). Añadido `organization_memberships`, `workspace_memberships`, `authority_bodies` y `organization_id` en raíces agregadas. Restricciones compuestas DB para impedir referencias cross-tenant. |
| **B-06** | Auditoría declarada inmutable sin defensas en Base de Datos | [`docs/architecture/ERD.md`](docs/architecture/ERD.md), [`docs/adr/ADR-0001-architecture.md`](docs/adr/ADR-0001-architecture.md), [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) | Sección 4 SQL Trigger | Añadida función trigger PostgreSQL `prevent_modification_or_deletion()` que rechaza `UPDATE` y `DELETE` en `audit_events`. Añadida cadena hash (`event_hash`, `previous_event_hash`) en la tabla. |
| **B-07** | Registro de decisiones con enlaces absolutos y falta de procedencia | [`docs/13_REGISTRO_DECISIONES.md`](docs/13_REGISTRO_DECISIONES.md), [`docs/00_ACTA_RATIFICACION_FASE_0.md`](docs/00_ACTA_RATIFICACION_FASE_0.md) | Toda la tabla | Convertidos todos los enlaces a **rutas relativas**. Creada el Acta Humana de Ratificación `docs/00_ACTA_RATIFICACION_FASE_0.md` (`ACTA-2026-001`) asignando autoridad exclusivamente al Órgano Promotor Humano (retirada la IA de atribuciones). |
| **B-08** | Backlog de Fase 1 no estructurado por puertas de calidad | [`docs/backlog/PHASE_1_BACKLOG.md`](docs/backlog/PHASE_1_BACKLOG.md) | Secciones 1, 2 y 3 | Reestructurado el backlog en **10 Puertas de Calidad Secuenciales** (Historias 1.1 a 10.1) cubriendo supply chain, isolation, identity, MFA, RBAC, auditoría transaccional, infra S3, observabilidad, backups out-of-band y QA. Marcado como `BLOQUEADO`. |

---

## 2. Tabla de Remediación de Hallazgos de Severidad Alta y Editorial (H-01 a H-05, M-01)

| ID Hallazgo | Descripción del Hallazgo | Archivo Modificado | Sección / Ubicación | Prueba de Cierre / Remediación Aplicada |
|---|---|---|---|---|
| **H-01** | Threat Model incompleto y controles marcados como existentes | [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) | Secciones 1, 2 y 3 | Incorporados los 12 vectores STRIDE (WebSockets, S3 URLs firmadas, supply chain, multi-tenant isolation, ClamAV). Todos los controles renombrados a **`PLANIFICADO`**. Eliminada recomendación universal `--disable-setuid-sandbox`. |
| **H-02** | Estrategia de sesión no decidida | [`docs/adr/ADR-0001-architecture.md`](docs/adr/ADR-0001-architecture.md), [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) | Sección 7 | Especificada estrategia de cookies JWT `HttpOnly`, `Secure`, `SameSite=Strict` con sesiones registradas en Redis para revocación inmediata. |
| **H-03** | Esquema de evidencia omitía metadatos de metodología | [`docs/architecture/ERD.md`](docs/architecture/ERD.md) | Tablas `sources` y `evidence_claims` | Añadidos campos `publication_date`, `access_date`, `jurisdiction`, `license`, `file_hash`, `passage_locator`, `claim_type`, `period`, `territory`, `calculation_method`, `verification_responsible`, `verification_date`, `structured_limitations` y `contradictory_evidence`. |
| **H-04** | Falta de independencia del Auditor | [`docs/03_ROLES_Y_PERMISOS.md`](docs/03_ROLES_Y_PERMISOS.md), [`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md) | Tabla de Roles | Creado explícitamente el rol `AUDITOR` con acceso exclusivo de lectura a `audit_events` e independiente de la administración de TI. |
| **H-05** | Operaciones de backup dentro de la aplicación web | [`docs/product/SCREEN_AND_FLOW_MAP.md`](docs/product/SCREEN_AND_FLOW_MAP.md), [`docs/backlog/PHASE_1_BACKLOG.md`](docs/backlog/PHASE_1_BACKLOG.md) | `SCR-23`, Gate 9 | Eliminada la función de restauración web en `SCR-23` (se mantiene solo monitoreo de salud). Las restauraciones quedan como procedimientos operativos **out-of-band** (scripts CLI fuera de la app). |
| **M-01** | Errores editoriales, tipográficos y enlaces locales | Todo el paquete | Múltiples archivos | Corregidos errores tipográficos ("Aesthetica" -> "Estética"), removidos enlaces `file:///` en favor de relativos, eliminadas líneas duplicadas. |
