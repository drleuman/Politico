# Matriz de Remediación Integración y Certificación Técnico-Diseño — Release Candidate v0.3.30 (Inmutable)

Fecha: 17 de septiembre de 2026  
Artefacto Canónico: `politica-canon-v0.3.30.zip`  
SHA-256: `f816e03130686c1bef5f1615da2f46e7f85dcb90ed3e375406e518b2460cbc2b`  
Tamaño: `140.096 bytes`  
Estado Versión Previa: `v0.3.29` declarada **SUPERSEDED / VOID** (anulada por regeneración post-certificación).  
Repositorio Git Canónico: `https://github.com/drleuman/Politico.git` (rama `release/v0.3.30-candidate`)  
Estado: **PASS — CANDIDATO TÉCNICO INMUTABLE CERTIFICADO PARA REVISIÓN DE GOBERNANZA**

---

## 1. Matriz de Remediación Técnica (Auditoría v0.3.28, v0.3.29 & v0.3.30)

| ID Hallazgo | Categoría | Descripción Breve | Remediación Implementada v0.3.30 | Estado |
| :--- | :--- | :--- | :--- | :---: |
| **Inmutabilidad** | **Gobernanza** | Garantía de hash único e inmutable por release | `v0.3.29` anulada (**SUPERSEDED / VOID**). `v0.3.30` se emite como candidato inmutable definitivo congelado tras verificación completa. | **PASS** |
| **M-04** | **Medio** | Integridad y autonomía en extracción limpia | Incorporado `RELEASE_FILES.json` con checksums SHA-256 de 51 archivos. `validate_v0.3.30.cjs` opera en ARTIFACT MODE y SOURCE TREE MODE. CHECK 4A valida criptografía nativa de referencia pre-`npm ci` y CHECK 4B valida el módulo compilado TypeScript post-build. | **PASS / CLOSED** |
| **H-05** | **Alto** | `email_worker` omitía `NOCREATEROLE` en `ALTER ROLE` | Corregido en [db/0000_bootstrap_roles.sql](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/db/0000_bootstrap_roles.sql) con `NOCREATEROLE`. Prueba de degradación y reconvergencia real en `test-integration-pg16.mjs` y verificaciones de catálogo en `bootstrap-post.mjs`. | **PASS / CLOSED** |
| **C-01** | Crítico | `npm test` script corregido | [package.json](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/package.json) apunta a `validate_v0.3.30.cjs` y el validador verifica la existencia de todos los archivos referenciados. | **PASS** |
| **C-02** | Crítico | Provisión systemd diferida pre-migración | `provision.sh` comprueba `information_schema.tables` y defiere `systemctl start` hasta aplicar las migraciones y bootstraps. | **PASS** |
| **H-01** | Alto | Descifrado legacy `enc:` | Descifrado transparente con candidatas de respaldo (`EMAIL_OUTBOX_LEGACY_KEY_V0` / `MFA_MASTER_KEY`). | **PASS** |
| **H-02** | Alto | Independencia criptográfica entre claves | `validateConfig()` exige en producción que `SESSION_SECRET`, `MFA_MASTER_KEY` y `EMAIL_OUTBOX_ENCRYPTION_KEY` sean distintas. | **PASS** |
| **H-03** | Alto | Contraseña PostgreSQL segura | `provision.sh` valida formato hex `^[a-f0-9]{32,64}$` y transmite la consulta vía `psql` stdin heredoc (0 exposición en `argv`/`ps`). | **PASS** |
| **H-04** | Alto | Validador ejecutable y autónomo | Comprobaciones binarias, compilación autónoma y pruebas reales de descifrado en `validate_v0.3.30.cjs`. | **PASS** |
| **M-01** | Medio | Sincronización total de metadatos | Versión `0.3.30` 100% consistente en package.json, provision.sh, server.ts, index.html, systemd, nginx, DDLs y scripts. | **PASS** |
| **M-02** | Medio | `.env.example` completo | `.env.example` documenta todas las variables de worker, claves de outbox y legado. | **PASS** |
| **M-03** | Medio | Docker pinning inmutable | Contenedores fijados con hashes `@sha256:` en `docker-compose.audit.yml`. | **PASS** |

---

## 2. Evaluación Frontend Integrada (Secciones A–J: Lentes `design-taste-frontend` y `emil-design-eng`)

*Nota de Gobernanza: Esta sección evalúa la arquitectura visual e interactiva de la interfaz de la intranet en desarrollo sin modificar código funcional en esta fase.*

- **A. Dirección de Diseño y Jerarquía Visual:** Paleta sobria en `public/index.html` con tonos obscuros (`#0d1117`, `#161b22`, `#58a6ff`).
- **B. Tipografía y Micro-Interacciones:** Uso de la familia tipográfica `Inter` y transiciones fluidas de 0.2s.
- **C. Accesibilidad y Semántica:** Elementos interactivos con IDs descriptivos y contrastes WCAG AA.
- **D. Manejo de Estados y Micro-animaciones (Lente Emil Kowalski):** Feedback activo en botones y tarjetas sin repintados.
- **E. Adaptabilidad Responsiva:** Contenedores flexbox/grid adaptados a múltiples resoluciones.
- **F. Coherencia Tecnológica:** Vanilla CSS/HTML optimizado sin sobrecarga de dependencias.
- **G. Manejo de Errores e Indicadores:** Indicadores de estado accesibles y semánticos.
- **H. Inmunidad a Degradación Estética:** Scrollbars restringidos y prevención de desbordamientos.
- **I. Integración de Componentes Accesibles:** Formularios con estados de foco explicito.
- **J. Balance Funcionalidad / Estética:** Foco en la neutralidad institucional y claridad de auditoría.
