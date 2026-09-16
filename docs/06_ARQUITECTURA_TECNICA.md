# Arquitectura Técnica y Monolito Modular — Política Canon v0.2.18

**Estado:** `CONSOLIDADO EN ADR-0001 (RATIFICACIÓN HUMANA)`  
**Fecha:** 2026-09-16  
**Paquete:** `politica-canon-v0.2.18`  

---

## 1. Resumen del Stack Tecnológico Ratificado

- **Backend Core:** Fastify + TypeScript en Monolito Modular.
- **Base de Datos Relacional:** **PostgreSQL 16+** gestionado con 25 políticas Row-Level Security (RLS) explícitas, roles de bootstrap con privilegio mínimo (`app_owner`, `app_user`, `audit_worker`, `audit_reader`) y migraciones SQL en [`db/migrations/0001_initial_schema.sql`](../db/migrations/0001_initial_schema.sql).
- **Tienda Autoritativa de Sesiones:** **Redis** (Persistencia AOF, Fail-Closed `503`).
- **Frontend App:** React + Vite + TypeScript (TipTap Editor, TailwindCSS, WebSockets).
- **Entorno de Despliegue y Arnés de Pruebas:** Servidor Plesk administrado mediante contenedor Docker aislado o servicio PostgreSQL 16+ dedicado ([`docker-compose.audit.yml`](../docker-compose.audit.yml)).
- **Motores de Arte Final:** Headless Chromium en contenedor efímero aislado sin red (`--net=none`) para PDF/HTML; librerías nativas dedicadas en Node.js para DOCX/EPUB.

---

## 2. Decisiones consolidadas en ADR-0001, ADR-0002 y ADR-0003

1. **[`ADR-0001-architecture.md`](adr/ADR-0001-architecture.md):** Adopción de Monolito Modular en monorepo TypeScript.
2. **[`ADR-0002-session-management.md`](adr/ADR-0002-session-management.md):** Sesiones opacas en Redis, Synchronizer Token Anti-CSRF y Hashing Argon2id de Backup Codes.
3. **[`ADR-0003-audit-logging-and-outbox.md`](adr/ADR-0003-audit-logging-and-outbox.md):** Auditoría append-only con Sequence Number, Hash Chain RFC 8785 (JCS), Genesis Hash (64 ceros), Worker Outbox (`src/audit/worker.ts`) e Idempotencia.
