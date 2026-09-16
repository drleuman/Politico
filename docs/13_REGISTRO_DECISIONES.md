# Registro de Decisiones Canónicas — Política Canon v0.2.18

**Estado:** `VIGENTE (RATIFICACIÓN HUMANA)`  
**Fecha:** 2026-09-16  
**Paquete:** `politica-canon-v0.2.18`  

---

| ID | Fecha | Estado | Decisión Canónica | Responsable | Evidencia / ADR |
|---|---|---|---|---|---|
| **DEC-2026-001** | 2026-09-15 | ACEPTADO | Adopción de la línea base documental v0.1.0 e iteración de remediación v0.2.15 | Órgano Promotor Humano / Ratificación Humana | [`CANON.md`](../CANON.md) |
| **ADR-0001** | 2026-09-15 | ACEPTADO | Monolito Modular en TypeScript (Fastify + Drizzle ORM + PostgreSQL 16+ + Redis + React) | Equipo Técnico / Órgano Promotor Humano | [`adr/ADR-0001-architecture.md`](adr/ADR-0001-architecture.md) |
| **ADR-0002** | 2026-09-15 | ACEPTADO | Sesiones opacas en Redis (fail-closed), Anti-CSRF Synchronizer Token y Hashing Argon2id de Backup Codes | Equipo Técnico / Órgano Promotor Humano | [`adr/ADR-0002-session-management.md`](adr/ADR-0002-session-management.md) |
| **ADR-0003** | 2026-09-15 | ACEPTADO | Auditoría Append-Only con Sequence Number, Hash Chain RFC 8785 (JCS), Genesis Hash, Lock Consultivo e Idempotencia Outbox | Equipo Técnico / Órgano Promotor Humano | [`adr/ADR-0003-audit-logging-and-outbox.md`](adr/ADR-0003-audit-logging-and-outbox.md) |
| **DEC-2026-002** | 2026-09-15 | ACEPTADO | Desacoplamiento total entre la publicación pública y la aprobación política del expediente | Órgano Promotor Humano | [`security/AUTHORIZATION_MATRIX.md`](security/AUTHORIZATION_MATRIX.md) |
| **DEC-2026-003** | 2026-09-15 | ACEPTADO | Exclusión incondicional del Admin técnico de competencias para redactar, aprobar o publicar contenidos | Órgano Promotor Humano | [`03_ROLES_Y_PERMISOS.md`](03_ROLES_Y_PERMISOS.md) |
| **DEC-2026-004** | 2026-09-15 | ACEPTADO | Esquema Físico DDL de 30 tablas con RLS (25 políticas explícitas) y claves compuestas `organization_id` para aislamiento multi-tenant | Órgano Promotor Humano | [`architecture/ERD.md`](architecture/ERD.md) |
| **DEC-2026-005** | 2026-09-15 | ACEPTADO | Colaboración mediante Control Optimista de Concurrencia (OCC) e hilos de comentarios anclados | Órgano Promotor Humano | [`04_FLUJO_EDITORIAL.md`](04_FLUJO_EDITORIAL.md) |
| **DEC-2026-006** | 2026-09-15 | PROPUESTO | Propuesta de remediación técnica v0.2.7 remitida para auditoría externa | Órgano Promotor Humano / Equipo Técnico | [`../REMEDIATION_MATRIX_v0.2.7.md`](../REMEDIATION_MATRIX_v0.2.7.md) |
| **DEC-2026-007** | 2026-09-15 | PROPUESTO | Harness ejecutable v0.2.15: DDL en `db/migrations/0001_initial_schema.sql`, provisioning en `db/bootstrap_roles.sql`, arnés `docker-compose.audit.yml`, worker outbox en `src/audit/worker.ts`, evaluador TS en `src/auth/authorization.ts` y 30 entidades conceptuales | Órgano Promotor Humano / Equipo Técnico | [`../REMEDIATION_MATRIX_v0.2.15.md`](../REMEDIATION_MATRIX_v0.2.15.md) |

---

## Regla de Registro

Cada entrada debe enlazar formalmente al documento o evidencia correspondientes. Este registro se mantiene actualizado de manera inmutable bajo la supervisión del Órgano Promotor Humano.
