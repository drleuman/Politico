# Documento de Requisitos del Producto (PRD) — Política Canon v0.2.18

**Estado:** `CONSOLIDADO EN LÍNEA BASE`  
**Fecha:** 2026-09-16  
**Paquete:** `politica-canon-v0.2.18`  

---

## 1. Visión del Producto

Construir una intranet colaborativa y sistema de publicación documental institucional para un proyecto político y económico relacionado con la federalización del Estado Plurinacional de Bolivia. La plataforma permite a miembros autorizados investigar, redactar, deliberar, revisar, aprobar normativamente y publicar documentos con trazabilidad auditada, aislamiento multi-tenant y máxima seguridad.

---

## 2. Requisitos Funcionales Completos (Restauración Canónica)

1. **Gestión de Identidad, Invitaciones y Sesiones:**
   - Registro exclusivo por invitación (`invitations` con restricción de roles sensibles `ADMIN`, `APPROVER`, `PUBLISHER`, `AUDITOR`), credenciales locales (`user_credentials` Argon2id) y recuperación via token (`password_reset_tokens`).
   - Autenticación TOTP MFA obligatorio para gobernanza y recursos confidenciales con validación de antigüedad finitica (<15 min / 900s).
   - Códigos de respaldo de un solo uso hacheados con Argon2id (`mfa_backup_codes`).
   - Sesiones opacas en Redis (fail-closed `503`) con Synchronizer Token Anti-CSRF.

2. **Espacios de Trabajo, Redacción y Comentarios Anclados:**
   - Aislamiento multi-tenant estricto entre organizaciones y espacios de trabajo (`workspaces`).
   - Editor de texto rico (TipTap) con Control Optimista de Concurrencia (OCC) e hilos de comentarios anclados (`draft_comments`).

3. **Fuentes, Evidencias, Datasets y Búsqueda:**
   - Repositorio de evidencias y citas bibliográficas (`source_citations`).
   - Gestión de conjuntos de datos cuantitativos, datasets sociodemográficos e indicadores económicos.
   - Buscador full-text con filtrado por facetas, clasificación y etiquetas.

4. **Flujo Editorial y Formulación Normativa:**
   - Congelamiento inmutable en `document_versions` con hash SHA-256 (`content_hash`) antes de la ronda de revisión (`submissions`).
   - Dictámenes de revisión inmutables (`ACCEPTED` o `REJECTED`) por revisores independientes (`reviews`).
   - Votación y resolución formal por Órganos de Autoridad (`authority_bodies` / `decisions`).

5. **Publicación Multi-formato (PDF, HTML, EPUB, DOCX):**
   - Impresión de arte final en formatos `PDF` y `HTML` mediante renderizador Headless Chromium en contenedor efímero aislado sin red (`--net=none`) ni privilegios.
   - Generación nativa de arte final en formatos `DOCX` y `EPUB` mediante librerías dedicadas en Node.js de forma aislada sin invocar Chromium.
   - Registro inmutable de artefactos publicados (`publication_events`) con `artifact_hash`, plantilla, motor renderizador y parámetros de impresión.

6. **Gobernanza de Roles y Auditoría Transactional Outbox:**
   - Separación estricta: el rol `ADMIN` técnico no puede aprobar ni publicar contenidos (Denegación Incondicional).
   - Doble Control obligatorio verificado en servidor (`grant_governance_role_transactional(p_organization_id, p_request_id)`) con 4 identidades distintas y verificación de miembros de `GOVERNANCE_REGISTRY`.
   - Cadena de auditoría hash chain append-only (`audit_events`) con `sequence_number` por organización, Genesis Hash (64 ceros), RLS en PostgreSQL 16+ con 25 políticas explícitas e idempotencia outbox via `outbox_id UNIQUE` y `audit_outbox_dead_letter`.

---

## 3. Especificación de Módulos Extendidos (Datasets, Búsqueda, Notificaciones & Dashboards)

Para garantizar la integridad entre el PRD y la arquitectura de datos:

1. **Contrato de Datasets e Indicadores (Fase 3):**
   - La plataforma gestiona series temporales sociodemográficas y económicas integradas mediante esquemas JSONB sanitizados asociados a la versión inmutable del documento (`source_citations` y metadatos de borrador).
2. **Motor de Búsqueda Facetada (Fase 4):**
   - Búsqueda full-text en PostgreSQL utilizando índices `tsvector` sobre títulos, resúmenes y AST de versiones congeladas, con facetas por clasificación, workspace y etiquetas.
3. **Canal de Notificaciones (Fase 3):**
   - Notificaciones de intranet in-app emitidas desde el worker outbox de auditoría evitando canales no auditados.
4. **Dashboards y Accesibilidad de Gráficos (Fase 4):**
   - Los dashboards ejecutivos se generan mediante gráficos SVG/Canvas accesibles (WCAG 2.1 AA) a partir de datos estructurados verificados.

---

## 4. Requisitos No Funcionales (NFR)

- **Rendimiento:** Tiempos de respuesta API < 200 ms (p95); carga de páginas < 1.5 s.
- **Disponibilidad:** 99.9% uptime supervisado en Plesk / Docker.
- **Privacidad y Retención:** Cifrado en reposo para secretos TOTP (AES-256-GCM), retención inmutable de registros de auditoría y política de conservación documental.
- **Accesibilidad:** Cumplimiento estándar WCAG 2.1 AA en interfaz React.
