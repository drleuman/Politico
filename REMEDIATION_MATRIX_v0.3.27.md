# Matriz de Remediación Integración y Certificación Técnico-Diseño — Release Candidate v0.3.27

Fecha: 17 de septiembre de 2026  
Artefacto: `politica-canon-v0.3.27.zip`  
Estado: **PASS (AUDITORÍA TÉCNICA Y REMEDIACIÓN CERTIFICADA)**

---

## 1. Matriz de Remediación Técnica (Auditoría v0.3.26)

| ID Hallazgo | Categoría | Descripción Breve | Remediación Implementada v0.3.27 | Estado |
| :--- | :--- | :--- | :--- | :---: |
| **C-01** | Crítico | `npm test` roto (apuntaba a `validate_v0.3.25.cjs`) | Actualizado `package.json` script `test` a `validate_v0.3.27.cjs` y añadida inspección dinámica de existencia de archivos en el validador. | **PASS** |
| **C-02** | Crítico | Provisión inicia servicios antes de migraciones | Refactorizado `provision.sh` para verificar la existencia de tablas de BD (`email_outbox`) antes de ejecutar `systemctl start`, evitando fallos en la primera instalación. | **PASS** |
| **H-01** | Alto | Descifrado de payloads legacy `enc:` fallaba | Implementado algoritmo de descifrado con claves candidatas de respaldo (`EMAIL_OUTBOX_LEGACY_KEY_V0` / `MFA_MASTER_KEY`) en [src/email/crypto-payload.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/email/crypto-payload.ts). | **PASS** |
| **H-02** | Alto | Independencia criptográfica entre claves | Aserciones estrictas en `validateConfig()` en [src/config/env.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/config/env.ts) que rechazan claves idénticas en producción. | **PASS** |
| **H-03** | Alto | Asignación de contraseña `psql` insegura | `provision.sh` exige `psql`, valida regex `^[a-f0-9]{32,64}$` y pasa el SQL mediante stdin heredoc sin exponer contraseñas en `argv`/`ps`. | **PASS** |
| **H-04** | Alto | Validador con falsos PASS semánticos | `validate_v0.3.27.cjs` incluye pruebas ejecutables directas de descifrado legacy `enc:`, verificación de archivosnpm y aserciones de independencia. | **PASS** |
| **M-01** | Medio | Sincronización de metadatos | Sincronizados todos los archivos a `v0.3.27` (`package.json`, `index.html`, `server.ts`, systemd, nginx, DDLs, migrador, worker). | **PASS** |
| **M-02** | Medio | `.env.example` desactualizado | Actualizado `.env.example` documentando `EMAIL_WORKER_DATABASE_URL`, `POLITICA_CANON_WORKER_DB_PASS`, `EMAIL_OUTBOX_ENCRYPTION_KEY` y legacy keys. | **PASS** |
| **M-03** | Medio | Inmutabilidad de imágenes Docker | Mantenida la sintaxis `@sha256:` con digests inmutables en `docker-compose.audit.yml`. | **PASS** |

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
- **I. Integración de Componentes Accesibles:** Formularios con estados de foco explícitos.
- **J. Balance Funcionalidad / Estética:** Foco en la neutralidad institucional y claridad de auditoría.
