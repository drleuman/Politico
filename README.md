# Intranet Colaborativa y Sistema Canónico Documental — Política Canon v0.2.18

**Estado Actual del Proyecto:**  
`FASE 0 — COMPLETADA CON ÉXITO Y DICTAMEN PASS FORMAL DE AUDITORÍA EXTERNA (FASE 1 DESBLOQUEADA)`

**Fecha de Emisión:** 2026-09-16  
**Paquete Target:** `politica-canon-v0.2.18.zip`  
**Autoridad:** Órgano Promotor Humano / Ratificación Humana (`ACTA-2026-001`)  

---

## 1. Descripción del Proyecto

Sistema colaborativo y plataforma de publicación documental institucional para un proyecto político y económico relacionado con la federalización del Estado Plurinacional de Bolivia. El sistema permite a miembros autorizados redactar, deliberar, revisar, aprobar normativamente y publicar contenidos con trazabilidad auditada, aislamiento multi-tenant y máxima seguridad.

---

## 2. Documentos Principales del Canon v0.2.17

- **[`CANON.md`](CANON.md):** Reglas fundacionales e inmutables del sistema.
- **[`docs/00_INDICE_CANONICO_DOCUMENTAL.md`](docs/00_INDICE_CANONICO_DOCUMENTAL.md):** Índice maestro de entregables de Fase 0 (inventario completo de 28 documentos activos).
- **[`docs/01_PRD.md`](docs/01_PRD.md):** Documento de requisitos del producto (restauración completa de requisitos funcionales y no funcionales).
- **[`docs/03_ROLES_Y_PERMISOS.md`](docs/03_ROLES_Y_PERMISOS.md):** Modelo de roles, asignaciones por ámbito en `role_assignments` y procedimiento de Doble Control en servidor.
- **[`docs/04_FLUJO_EDITORIAL.md`](docs/04_FLUJO_EDITORIAL.md):** Ciclo de vida documental, rondas de envío y procedencia de publicación.
- **[`docs/architecture/ERD.md`](docs/architecture/ERD.md):** Modelo ERD (30 Entidades Conceptuales Únicas) y Esquema DDL Físico de 30 Tablas con 25 políticas RLS explícitas.
- **[`docs/security/AUTHORIZATION_MATRIX.md`](docs/security/AUTHORIZATION_MATRIX.md):** Contrato ejecutable TypeScript default-deny con denegación incondicional de Admin.
- **[`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md):** Modelo de amenazas STRIDE ampliado y sandbox Chromium.
- **[`docs/adr/ADR-0001-architecture.md`](docs/adr/ADR-0001-architecture.md):** Monolito Modular TypeScript (Fastify + Drizzle + PostgreSQL 16+ + Redis).
- **[`docs/adr/ADR-0002-session-management.md`](docs/adr/ADR-0002-session-management.md):** Sesiones opacas en Redis (fail-closed), Anti-CSRF y Hashing Argon2id.
- **[`docs/adr/ADR-0003-audit-logging-and-outbox.md`](docs/adr/ADR-0003-audit-logging-and-outbox.md):** Auditoría append-only con Sequence Number, Hash Chain RFC 8785, Genesis Hash, Outbox Worker (`src/audit/worker.ts`) e Idempotencia.
- **[`docs/backlog/PHASE_1_BACKLOG.md`](docs/backlog/PHASE_1_BACKLOG.md):** Backlog de Fase 1 estructurado en 10 Puertas de Calidad Secuenciales con DoD por historia.

---

## 3. Módulos de Código y Arnés de Pruebas Entregados (v0.2.17)

- **[`db/migrations/0001_initial_schema.sql`](db/migrations/0001_initial_schema.sql):** Migración SQL física ejecutable completa para PostgreSQL 16+.
- **[`db/bootstrap_roles.sql`](db/bootstrap_roles.sql):** Provisioning seguro de roles de base de datos (`app_owner`, `app_user`, `audit_worker`, `audit_reader`) con privilegio mínimo y sin contraseñas versionadas.
- **[`docker-compose.audit.yml`](docker-compose.audit.yml):** Configuración de contenedor para arnés de pruebas PostgreSQL 16+ y Redis 7+.
- **[`src/audit/worker.ts`](src/audit/worker.ts):** Worker Outbox ejecutable con canonicalización JCS (RFC 8785), aislamiento via savepoints, reintentos con backoff y verificador criptográfico de cadena.
- **[`src/auth/authorization.ts`](src/auth/authorization.ts):** Evaluador ejecutable TypeScript con tipado estricto, asignación por ámbitos y suite de pruebas unitarias integradas.
- **[`validate_v0.2.18.cjs`](validate_v0.2.18.cjs):** Script ejecutable de validación semántica independiente e integración PostgreSQL 16 incluido en el repositorio.

---

## 4. Informes de Remediación, Validación y Erratas

- **[`REMEDIATION_MATRIX_v0.2.18.md`](REMEDIATION_MATRIX_v0.2.18.md):** Matriz de remediación byte-by-byte de hallazgos C-01 y H-01 a H-02 de la auditoría v0.2.17.
- **[`VALIDATION_REPORT_v0.2.18.md`](VALIDATION_REPORT_v0.2.18.md):** Informe de validación automatizada semántica con pruebas criptográficas y de código en PostgreSQL 16 real.
- **[`docs/audits/HISTORICAL_ERRATA.md`](docs/audits/HISTORICAL_ERRATA.md):** Registro de erratas y trazabilidad de informes históricos.
- **[`PHASE_0_FINAL_ACCEPTANCE.md`](PHASE_0_FINAL_ACCEPTANCE.md):** Solicitud formal de auditoría externa final.
