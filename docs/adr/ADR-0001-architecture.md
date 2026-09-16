# ADR-0001 — Arquitectura de Software Monolito Modular en Monorepo — Política Canon v0.2.18

**Estado:** `ACEPTADO (RATIFICACIÓN HUMANA)`  
**Fecha de Propuesta:** 2026-09-16  
**Fecha de Ratificación:** 2026-09-15  
**Paquete:** `politica-canon-v0.2.18`  
**Responsables:** Equipo Técnico / Órgano Promotor Humano  

---

## 1. Contexto

Se requiere definir la arquitectura de software de la plataforma colaborativa de investigación y gobernanza. El sistema debe soportar coedición ligera, dictámenes de revisión, votación de resoluciones, auditoría inmutable y publicación multi-formato con aislamiento multi-tenant.

---

## 2. Decisión

Se adopta una arquitectura de **Monolito Modular en Monorepo TypeScript** compuesto por:

1. **Backend Monolítico Modular (Fastify + TypeScript):** Módulos independientes desacoplados (Auth, Identity, Workspaces, Documents, Submissions, Reviews, Governance, Audit, Publications).
2. **Capa de Persistencia (PostgreSQL 16+ + Drizzle ORM + RLS):** Base de datos relacional única con políticas Row-Level Security explícitas en las 25 tablas tenant-scoped.
3. **Tienda de Sesiones (Redis):** Tienda autoritativa de sesión opaca en Redis con Fail-Closed `503`.
4. **Cliente Web (React + Vite + TypeScript):** Editor TipTap, componentes UI y WebSockets.
5. **Infraestructura y Despliegue (Plesk / Docker):** Despliegue supervisado en Plesk mediante contenedor Docker o servicio PostgreSQL 16+ dedicado.
6. **Motores de Arte Final:** Contenedor Headless Chromium efímero aislado sin red (`--net=none`) para PDF/HTML; librerías nativas dedicadas en Node.js para DOCX/EPUB.

---

## 3. Consecuencias

- **Positivas:** Simplicidad de mantenimiento, tipado compartido estricto, facilidad de despliegue en servidor Plesk.
- **Riesgos:** Riesgo de acoplamiento modular. Mitigado mediante contratos de interfaz entre módulos.
