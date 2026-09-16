# Modelo de Datos y Gobernanza de Persistencia — Política Canon v0.2.18

**Estado:** `CONSOLIDADO EN ERD (RATIFICACIÓN HUMANA)`  
**Fecha:** 2026-09-16  
**Paquete:** `politica-canon-v0.2.18`  

---

## 1. Consolidación Estructural

La definición física completa de las 30 tablas DDL ejecutables, tipos enumerados, restricciones compuestas multi-tenant, función transaccional de doble control `grant_governance_role_transactional(p_organization_id, p_request_id)`, políticas Row-Level Security (RLS) en 25 tablas tenant-scoped y disparadores anti-CASCADE se encuentra consolidada en:

> [`architecture/ERD.md`](architecture/ERD.md) y [`db/migrations/0001_initial_schema.sql`](../db/migrations/0001_initial_schema.sql)

---

## 2. Resumen de Gobernanza de Datos v0.2.16

- **Entidades Conceptuales:** Exactly 30 Entidades Únicas del Dominio.
- **Tablas Físicas DDL (PostgreSQL 16+):** Exactly 30 Tablas DDL Físicas.
- **Defensa Multi-tenant:** RLS en las 25 tablas tenant-scoped (`FORCE ROW LEVEL SECURITY`) con políticas explícitas `USING` y `WITH CHECK` mediante `app.current_organization_id` + Rol de aplicación `app_user` sin `BYPASSRLS`.
- **Fuente Unificada de Asignación de Roles:** Tabla `role_assignments` con `scope_type`, `scope_id` y vigencia temporal.
- **Inmutabilidad Anti-CASCADE:** Disparadores SQL anti-CASCADE y `ON DELETE RESTRICT` en las 9 tablas inmutables del sistema.
