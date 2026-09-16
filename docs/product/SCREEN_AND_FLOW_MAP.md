# Mapa de Pantallas y Flujos de Usuario — Política Canon v0.2.18

**Estado:** `VIGENTE (RATIFICACIÓN HUMANA)`  
**Fecha:** 2026-09-16  
**Paquete:** `politica-canon-v0.2.18`  

---

## 1. Inventario de Pantallas de la Intranet (25 Pantallas)

| ID | Pantalla | Propósito y Capacidades | Acceso Rol |
|---|---|---|---|
| `SCR-01` | Dashboard Principal | Resumen de actividad, borradores recientes, notificaciones. | Autenticado |
| `SCR-02` | Selector de Workspace | Conmutador de organización y espacio de trabajo activo. | Autenticado |
| `SCR-03` | Administración de Usuarios | Gestión de miembros, invitaciones y solicitudes de rol. | `ADMIN`, `COORDINATOR` |
| `SCR-04` | Solicitud de Rol Sensible | Creación de solicitud para roles `APPROVER`, `PUBLISHER`, `AUDITOR`. | `COORDINATOR` |
| `SCR-04B`| Doble Control de Roles | Interfaz de aprobación dual para miembros de `GOVERNANCE_REGISTRY`. | Miembros Registro Gobernanza |
| `SCR-05` | Navegador de Documentos | Lista filtrable de documentos por workspace y clasificación. | Autenticado |
| `SCR-06` | Editor de Borradores (TipTap) | Edición colaborativa rica con OCC e hilos de comentarios anclados. | `WRITER`, `COORDINATOR` |
| `SCR-07` | Historial de Versiones | Comparación diff entre `working_drafts` y `document_versions`. | Autenticado |
| `SCR-08` | Panel de Envíos a Revisión | Creación de rondas de revisión (`SUBMIT_FOR_REVIEW`). | `WRITER`, `COORDINATOR` |
| `SCR-09` | Evaluación de Revisor | Emisión de dictámenes inmutables (`ACCEPTED` / `REJECTED`). | `REVIEWER` |
| `SCR-10` | Tablón del Órgano de Autoridad | Presentación de expedientes dictaminados para votación. | `APPROVER` |
| `SCR-11` | Votación y Aprobación | Registro de voto y firma de resolución de aprobación. | `APPROVER` |
| `SCR-12` | Consola de Publicación | Emisión de artefactos impresos (PDF, HTML, EPUB, DOCX) en `publication_events`. | `PUBLISHER` |
| `SCR-13` | Portal de Publicaciones | Visualización pública o restringida de documentos publicados. | Todos |
| `SCR-14` | Visor de Auditoría | Consulta de la cadena hash inmutable de `audit_events`. | `AUDITOR` |
| `SCR-15` | Perfil de Usuario & MFA | Configuración de credenciales, TOTP y generación de códigos de respaldo. | Autenticado |
| `SCR-16` | Gestión de Sesiones Activas | Lista de sesiones activas y opción de cierre remoto (`GLOBAL_LOGOUT`). | Autenticado |
| `SCR-17` | Repositorio de Evidencias | Gestión de citas de fuentes (`source_citations`) y bibliografía. | Autenticado |
| `SCR-18` | Búsqueda Avanzada | Buscador full-text con filtros por metadatos y etiquetas. | Autenticado |
| `SCR-19` | Configuración de Notificaciones | Ajustes de alertas por correo e in-app. | Autenticado |
| `SCR-20` | Registro de Decisiones | Índice canónico de decisiones normativas aprobadas. | Autenticado |
| `SCR-21` | Glosario Institucional | Términos y definiciones canónicas compartidas. | Autenticado |
| `SCR-22` | Mapa de Cobertura de Requisitos| Trazabilidad de historias y puertas de calidad. | Autenticado |
| `SCR-23` | Monitoreo de Salud e Infraestructura | Panel de solo lectura con estado de base de datos, Redis y backups. | `ADMIN` |
| `SCR-24` | Registro de Invitaciones | Emisión y control de tokens de invitación (`invitations`). | `ADMIN`, `COORDINATOR` |

*Nota de Seguridad:* Las restauraciones de copias de seguridad se realizan exclusivamente por CLI mediante scripts out-of-band.
