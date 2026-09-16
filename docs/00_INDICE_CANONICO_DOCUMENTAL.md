# Índice Canónico Documental — Política Canon v0.2.18

**Estado General del Paquete:** `FASE 0 — REMEDIACIÓN v0.2.18 REALIZADA CON ÉXITO; PENDIENTE DE AUDITORÍA EXTERNA FINAL`  
**Fecha de Emisión:** 2026-09-16  
**Paquete Target:** `politica-canon-v0.2.18.zip`  

---

## Tabla Maestra Completa de Documentos del Repositorio (`v0.2.18`)

| ID Documento | Título del Entregable | Versión | Estado Canónico | Archivo Relativo |
|---|---|---|---|---|
| `DOC-000` | Acta Fundacional y Ratificación Humana | `0.2.17` | `RATIFICADO` | [`00_ACTA_RATIFICACION_FASE_0.md`](00_ACTA_RATIFICACION_FASE_0.md) |
| `DOC-001` | Índice Canónico Documental | `0.2.17` | `VIGENTE` | [`00_INDICE_CANONICO_DOCUMENTAL.md`](00_INDICE_CANONICO_DOCUMENTAL.md) |
| `DOC-002` | Documento de Requisitos del Producto (PRD) | `0.2.17` | `VIGENTE` | [`01_PRD.md`](01_PRD.md) |
| `DOC-002B`| Arquitectura de Información | `0.2.17` | `VIGENTE` | [`02_ARQUITECTURA_INFORMACION.md`](02_ARQUITECTURA_INFORMACION.md) |
| `DOC-003` | Modelo de Roles, Permisos y Gobernanza | `0.2.17` | `VIGENTE` | [`03_ROLES_Y_PERMISOS.md`](03_ROLES_Y_PERMISOS.md) |
| `DOC-004` | Flujo Editorial, Ciclo de Vida y Publicación | `0.2.17` | `VIGENTE` | [`04_FLUJO_EDITORIAL.md`](04_FLUJO_EDITORIAL.md) |
| `DOC-005` | Metodología de Evidencia y Fuentes | `0.2.17` | `VIGENTE` | [`05_METODOLOGIA_EVIDENCIA.md`](05_METODOLOGIA_EVIDENCIA.md) |
| `DOC-006` | Arquitectura Técnica y Monolito Modular | `0.2.17` | `CONSOLIDADO` | [`06_ARQUITECTURA_TECNICA.md`](06_ARQUITECTURA_TECNICA.md) |
| `DOC-007` | Modelo de Datos y Persistencia | `0.2.17` | `CONSOLIDADO` | [`07_MODELO_DATOS.md`](07_MODELO_DATOS.md) |
| `DOC-008` | Seguridad, Cifrado y Privacidad | `0.2.17` | `VIGENTE` | [`08_SEGURIDAD_PRIVACIDAD.md`](08_SEGURIDAD_PRIVACIDAD.md) |
| `DOC-009` | Generación e Impresión Documental | `0.2.17` | `VIGENTE` | [`09_GENERACION_DOCUMENTOS.md`](09_GENERACION_DOCUMENTOS.md) |
| `DOC-010` | Dashboards y Métricas Cuantitativas | `0.2.17` | `VIGENTE` | [`10_DASHBOARDS.md`](10_DASHBOARDS.md) |
| `DOC-011` | Despliegue en Servidor Plesk | `0.2.17` | `VIGENTE` | [`11_DESPLIEGUE_PLESK.md`](11_DESPLIEGUE_PLESK.md) |
| `DOC-012` | Roadmap del Proyecto | `0.2.17` | `VIGENTE` | [`12_ROADMAP.md`](12_ROADMAP.md) |
| `DOC-013` | Registro de Decisiones Canónicas | `0.2.17` | `VIGENTE` | [`13_REGISTRO_DECISIONES.md`](13_REGISTRO_DECISIONES.md) |
| `DOC-014` | Glosario Institucional | `0.2.17` | `VIGENTE` | [`14_GLOSARIO.md`](14_GLOSARIO.md) |
| `DOC-015` | Criterios de Aceptación MVP | `0.2.17` | `VIGENTE` | [`15_CRITERIOS_ACEPTACION_MVP.md`](15_CRITERIOS_ACEPTACION_MVP.md) |
| `DOC-ADR1`| ADR-0001: Monolito Modular | `0.2.17` | `ACEPTADO` | [`adr/ADR-0001-architecture.md`](adr/ADR-0001-architecture.md) |
| `DOC-ADR2`| ADR-0002: Sesiones, CSRF y MFA | `0.2.17` | `ACEPTADO` | [`adr/ADR-0002-session-management.md`](adr/ADR-0002-session-management.md) |
| `DOC-ADR3`| ADR-0003: Auditoría Append-Only, Outbox y Locks | `0.2.17` | `ACEPTADO` | [`adr/ADR-0003-audit-logging-and-outbox.md`](adr/ADR-0003-audit-logging-and-outbox.md) |
| `DOC-ERD` | Modelo ERD y Esquema DDL Físico (30 Tablas, 25 RLS) | `0.2.17` | `VIGENTE` | [`architecture/ERD.md`](architecture/ERD.md) |
| `DOC-BKL` | Backlog de Trabajo de Fase 1 | `0.2.17` | `BLOQUEADO` | [`backlog/PHASE_1_BACKLOG.md`](backlog/PHASE_1_BACKLOG.md) |
| `DOC-MAP` | Mapa de Pantallas y Flujos de Usuario | `0.2.17` | `VIGENTE` | [`product/SCREEN_AND_FLOW_MAP.md`](product/SCREEN_AND_FLOW_MAP.md) |
| `DOC-AUT` | Matriz de Autorización Causal | `0.2.17` | `VIGENTE` | [`security/AUTHORIZATION_MATRIX.md`](security/AUTHORIZATION_MATRIX.md) |
| `DOC-STR` | Modelo de Amenazas (STRIDE Ampliado) | `0.2.17` | `VIGENTE` | [`security/THREAT_MODEL.md`](security/THREAT_MODEL.md) |
| `DOC-GAP` | Análisis de Brechas e Historial | `0.2.17` | `HISTÓRICO` | [`audits/PHASE_0_GAP_ANALYSIS.md`](audits/PHASE_0_GAP_ANALYSIS.md) |
| `DOC-WLK` | Walkthrough de Verificación de Auditoría | `0.2.17` | `VIGENTE` | [`audits/PHASE_0_WALKTHROUGH.md`](audits/PHASE_0_WALKTHROUGH.md) |
| `DOC-ERR` | Erratas y Notas Históricas | `0.2.17` | `VIGENTE` | [`audits/HISTORICAL_ERRATA.md`](audits/HISTORICAL_ERRATA.md) |

---

## Informes de Remediación y Código Entregado (`v0.2.17`)

- Migraciones SQL PostgreSQL 16+: [`../db/migrations/0001_initial_schema.sql`](../db/migrations/0001_initial_schema.sql)
- Provisioning de Roles de BD: [`../db/bootstrap_roles.sql`](../db/bootstrap_roles.sql)
- Arnés de Pruebas Docker Compose: [`../docker-compose.audit.yml`](../docker-compose.audit.yml)
- Módulo del Worker Outbox y Criptografía: [`../src/audit/worker.ts`](../src/audit/worker.ts)
- Módulo de Autorización Causal y Tests TS: [`../src/auth/authorization.ts`](../src/auth/authorization.ts)
- Matriz de Remediación de Auditoría v0.2.17: [`../REMEDIATION_MATRIX_v0.2.17.md`](../REMEDIATION_MATRIX_v0.2.17.md)
- Informe de Validación Automatizada v0.2.17: [`../VALIDATION_REPORT_v0.2.17.md`](../VALIDATION_REPORT_v0.2.17.md)
- Script de Validación Incluido en Repositorio: [`../validate_v0.2.17.cjs`](../validate_v0.2.17.cjs)
- Aceptación Final y Solicitud de Auditoría Externa: [`../PHASE_0_FINAL_ACCEPTANCE.md`](../PHASE_0_FINAL_ACCEPTANCE.md)
