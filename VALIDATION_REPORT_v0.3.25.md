# Informe de Validación y Auditoría Enriquecida — Política Canon v0.3.25

**Fecha:** 17 de septiembre de 2026  
**Artefacto Auditado:** `politica-canon-v0.3.25.zip`  
**Manifiesto Externo:** `MANIFEST_v0.3.25.json`  
**Línea Base Productiva Certificada:** Tag `v0.3.17` (`ed74688`)  
**Servidor de Producción Activo:** Versión `v0.3.11` (Plesk / Ubuntu 24.04)  
**Dictamen Técnico:** **PASS — 7/7 CONTROLES SUPERADOS Y SUITE DE INTEGRACIÓN COMPLETA**

---

## 1. Identidad e Higiene Criptográfica del Artefacto v0.3.25

| Control | Especificación / Esperado | Resultado Observado | Estado |
|---|---|---|---|
| **Nombre de ZIP** | `politica-canon-v0.3.25.zip` | `politica-canon-v0.3.25.zip` | PASS |
| **Manifiesto Externo** | `MANIFEST_v0.3.25.json` | Coincide en versión, hash, tamaño e inventario | PASS |
| **Raíz Interna Única** | `politica-canon-v0.3.25/` | `politica-canon-v0.3.25/` | PASS |
| **Higiene del ZIP** | Sin `.git`, `.env`, `node_modules` ni `dist/` | 100% Limpio y Reproducible | PASS |
| **Sintaxis Gate (`node --check`)** | Sintaxis limpia en runner, worker, migrador y validador | PASS | PASS |
| **Integridad de Finales de Línea** | Todos los scripts shell en LF puro (`\n`), 0 CRLF | PASS | PASS |
| **`npm ci` / `npm run build`** | Compilación TypeScript limpia de 0 errores | PASS | PASS |
| **`npm audit --omit=dev`** | 0 vulnerabilidades de severidad Alta o Crítica | PASS (0 vulnerabilities) | PASS |
| **Validador Portable (`validate_v0.3.25.cjs`)** | 7/7 Controles superados en Node.js puro | PASS | PASS |

---

## 2. Remediación de Hallazgos Técnicos Bloqueantes (C-01 a M-04)

### C-01 — Normalización LF de Scripts Shell
- **FACT:** `provision.sh` contenía finales CRLF (`\r\n`), impidiendo la resolución de delimitadores heredoc en Bash en Ubuntu (`syntax error: unexpected end of file`).
- **REMEDIACIÓN:** Se creó el archivo [.gitattributes](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/.gitattributes) (`*.sh text eol=lf`), se convirtieron los scripts shell a LF puro (`\n`) y se añadió un check mecánico de finales de línea en el validador estático.

### C-02 — Gestión Atómica de Contraseñas del Worker
- **FACT:** `0002_bootstrap_permissions.sql` contenía una contraseña de desarrollo harcodeada (`email_worker_dev_pass`), mientras que la URL de provisión se generaba con `sed` desde la clave de la aplicación web.
- **REMEDIACIÓN:** Se eliminaron las claves harcodeadas del SQL versionado. `provision.sh` genera/preserva atómicamente la clave `WORKER_DB_PASS`, la asigna mediante `ALTER ROLE` en PostgreSQL como superusuario y construye la URL del worker concatenando credenciales de forma robusta.

### C-03 — Configuración Fail-Closed del Worker
- **FACT:** `EMAIL_WORKER_DATABASE_URL` tenía un fallback opcional a `DATABASE_URL` (usuario web `politica_canon_app`), ocasionando bucles de error sin fallar cerrado.
- **REMEDIACIÓN:** Se hizo obligatoria la variable `EMAIL_WORKER_DATABASE_URL` en el worker. Se implementó la función `checkEmailWorkerSecurity` que valida en el arranque `db_user === 'politica_canon_email_worker'`, `rolsuper = false` y la matriz exacta de permisos DML.

### C-04 — Inhabilitación en Primera Instalación Systemd
- **FACT:** `provision.sh` solo ejecutaba `systemctl enable --now` si el servicio ya estaba activo o habilitado, saltándose el arranque en servidores limpios.
- **REMEDIACIÓN:** Se actualizó `provision.sh` para ejecutar `systemctl daemon-reload` y `systemctl enable --now` de forma incondicional para ambas unidades (`politica-canon.service` y `politica-canon-outbox-worker.service`), verificando `is-active` fail-closed sin `|| true`.

### C-05 — Separación Completa de Identidades en la Suite E2E
- **FACT:** La suite de integración llamaba a `processEmailOutbox(dbPool)` con el pool web en la prueba de restablecimiento de contraseña.
- **REMEDIACIÓN:** Se sustituyeron todas las invocaciones por `processEmailOutbox(emailWorkerPool)` autenticado con `politica_canon_email_worker`.

### H-01 — Cifrado de Tokens en Reposo en el Outbox
- **FACT:** Los tokens activos se almacenaban en texto claro en `email_outbox` mientras el registro estaba en estado `PENDING` o `PROCESSING`.
- **REMEDIACIÓN:** Se implementó [src/email/crypto-payload.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/email/crypto-payload.ts) con cifrado AES-256-GCM. Los tokens se persisten cifrados (`enc:...`), se descifran exclusivamente en memoria al procesar el envío SMTP y se sobrescriben con `'[REDACTED]'` en estados terminales (`SENT`/`FAILED`).

### H-04 — Matriz de Mínimos Privilegios DML en `email_outbox`
- **FACT:** El rol `email_worker` conservaba el permiso `INSERT` innecesario.
- **REMEDIACIÓN:** Se revocó `INSERT` y `DELETE` de `email_worker` y `politica_canon_email_worker`. `politica_canon_app` solo posee `INSERT`, mientras que `politica_canon_email_worker` solo posee `SELECT, UPDATE`.

---

## 3. AUDITORÍA DE DISEÑO FRONTEND Y PRODUCTO (SECCIONES A - J)

> [!NOTE]
> La siguiente auditoría integra de forma orientativa las habilidades `design-taste-frontend` y `emil-design-eng` como criterio analítico conceptual, sin alterar la UI ni constituir un gate bloqueante para la release candidate técnica v0.3.25.

### Jerarquía de Responsabilidades Aplicada

1. **Requerimientos de producto Política, comportamiento del dominio, semántica de datos y neutralidad política** (Inviolable).
2. **Arquitectura existente de la aplicación, flujos de trabajo, permisos y contratos de API.**
3. **Sistema de diseño existente de Política, componentes reutilizables y tokens.**
4. **`design-taste-frontend`** (Jerarquía visual, densidad y composición).
5. **`emil-design-eng`** (Ingeniería de interacción y microinteracciones).

---

### A. Sistema de Diseño Frontend Existente

- **Arquitectura:** Monolito Fastify que sirve HTML/CSS/JS estáticos desde `public/` y consumo de API REST JSON.
- **Estructura HTML:** [public/index.html](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/public/index.html) estructura semántica HTML5 básica (`<header>`, `<main>`, `<section>`, `<article>`).
- **Paleta de Colores y Tokens CSS:**
  - Fondo base: `#0d1117` (Oscuro calmo operativo)
  - Fondo de tarjeta: `rgba(22, 27, 34, 0.85)` (Glassmorphism con blur de 16px)
  - Bordes: `rgba(48, 54, 61, 0.8)`
  - Texto principal: `#f0f6fc`
  - Texto secundario: `#8b949e`
  - Colores de acento de sistema: Azul (`#58a6ff`), Esmeralda (`#3fb950`), Ámbar (`#d29922`), Rojo (`#f85149`)
- **Tipografía:** Familia `Inter` con escala jerárquica sobria.

---

### B. Elementos que Deben Preservarse

- **Tipografía Inter:** Legibilidad óptima para lectura prolongada de documentos y actas.
- **Fondo Oscuro Calmo (`#0d1117`):** Tono profesional que minimiza la fatiga visual.
- **Estructura Semántica y Neutralidad:** Tratamiento uniforme de miembros e invitaciones sin sesgos.

---

### C. Problemas Estructurales de UI

- **Encajonamiento Repetitivo en Tarjetas:** Uso indiscriminado de tarjetas envolventes (`.card`), lo que fragmenta el flujo visual.
- **Densidad Desequilibrada:** Espaciado amplio en formularios contrastado con tablas comprimidas.
- **Falta de Revelación Progresiva:** Ausencia de paneles contextuales para inspeccionar detalles sin abandonar la vista principal.

---

### D. Hallazgos Bajo el Lente de `design-taste-frontend` (Visual)

- **Estética SaaS Genérica:** Adornos decorativos de fondo y glassmorphism prescindibles en un entorno operativo de gobernanza.
- **Saturación de Badges:** Exceso de píldoras de colores en tablas de datos.
- **Titulares Sobredimensionados:** Competición de jerarquía entre encabezados y datos clave.

---

### E. Hallazgos Bajo el Lente de `emil-design-eng` (Ingeniería de Interacción)

- **Falta de Feedback `:active`:** Ausencia de respuesta táctil/física al cliquear botones.
- **Transiciones Tosca en Modales:** Apertura y cierre instantáneo sin curvas de aceleración (easing) ni soporte para `prefers-reduced-motion`.
- **Estados Deshabilitados Ambiguos:** Botones inactivos que solo varían opacidad sin comunicar progreso.

---

### F. Hallazgos de Accesibilidad (Priorizados)

1. **CRITICAL — Anillo de Enfoque Teclado Ausente:** Falta de estilos `:focus-visible` claros en controles interactivos.
2. **HIGH — Estructura Modal ARIA Incompleta:** Falta de `role="dialog"`, `aria-modal="true"` y atrapado de foco (`focus-trap`).
3. **HIGH — Contraste de Texto Secundario:** El color `#8b949e` requiere ajuste de contraste sobre fondos oscuros.
4. **MEDIUM — Target Táctil Móvil:** Botones de tabla con altura menor a 44px en móviles.

---

### G. Riesgos de Neutralidad Política

- **Garantía Verificada:** Los colores de acento (`#58a6ff`, `#3fb950`, `#d29922`, `#f85149`) se utilizan **exclusivamente** para representar estados de la aplicación (`ACTIVE`, `PENDING`, `WARNING`, `ERROR`). Ningún partido, postura o actor político recibe jerarquía o tratamiento cromático diferenciado.

---

### H. Oportunidades de Consolidación de Componentes

- Primitiva unificada de `Button` (variantes primary, secondary, danger, ghost).
- Componente de tabla densa `DataTable` con cabeceras fijas y estados vacíos estandarizados.
- Primitiva accesible de `Dialog / Drawer` reutilizable.

---

### I. Adaptabilidad Responsive y Densidad

- El diseño actual fuerza un contenedor centrado de 800px en escritorio.
- En móvil, se recomienda sustituir tablas complejas por listas tipo card con drawers contextuales.

---

### J. Secuencia de Remediación Frontend Sugerida (Para Fase Futura)

1. **Fase 1:** Limpieza de arquitectura CSS y tokens.
2. **Fase 2:** Accesibilidad, foco e interacciones de teclado.
3. **Fase 3:** Consolidación de primitives (`Button`, `Dialog`, `DataTable`).
4. **Fase 4:** Microinteracciones y pulido de animación con `emil-design-eng`.

---

## 4. Dictamen de Gobernanza y Conclusión

- **Merge a `main`:** NO AUTORIZADO (Pendiente de auditoría humana independiente).
- **Creación de Tag `v0.3.25`:** NO AUTORIZADO.
- **Despliegue en Plesk:** NO AUTORIZADO.
- **Servidor de Producción:** Mantiene la versión activa `v0.3.11` (baseline Git `v0.3.17`).
