# Informe de Validación y Auditoría Enriquecida — Política Canon v0.3.24

**Fecha:** 17 de septiembre de 2026  
**Artefacto Auditado:** `politica-canon-v0.3.24.zip`  
**Manifiesto Externo:** `MANIFEST_v0.3.24.json`  
**Línea Base Productiva Certificada:** Tag `v0.3.17` (`ed74688`)  
**Servidor de Producción Activo:** Versión `v0.3.11` (Plesk / Ubuntu 24.04)  
**Dictamen Técnico:** **PASS — 7/7 CONTROLES SUPERADOS Y SUITE DE INTEGRACIÓN COMPLETA**

---

## 1. Identidad e Higiene Criptográfica del Artefacto v0.3.24

| Control | Especificación / Esperado | Resultado Observado | Estado |
|---|---|---|---|
| **Nombre de ZIP** | `politica-canon-v0.3.24.zip` | `politica-canon-v0.3.24.zip` | PASS |
| **Manifiesto Externo** | `MANIFEST_v0.3.24.json` | Coincide en versión, hash, tamaño e inventario | PASS |
| **Raíz Interna Única** | `politica-canon-v0.3.24/` | `politica-canon-v0.3.24/` | PASS |
| **Higiene del ZIP** | Sin `.git`, `.env`, `node_modules` ni `dist/` | 100% Limpio y Reproducible | PASS |
| **Sintaxis Gate (`node --check`)** | Sintaxis limpia en runner, worker, migrador y validador | PASS | PASS |
| **`npm ci` / `npm run build`** | Compilación TypeScript limpia de 0 errores | PASS | PASS |
| **`npm audit --omit=dev`** | 0 vulnerabilidades de severidad Alta o Crítica | PASS (0 vulnerabilities) | PASS |
| **Validador Portable (`validate_v0.3.24.cjs`)** | 7/7 Controles superados en Node.js puro | PASS | PASS |

---

## 2. Remediación de Hallazgos Técnicos Bloqueantes (C-01 a M-05)

### C-01 — Identidad LOGIN Dedicada del Worker de Correo
- **FACT:** El worker autónomo operaba con el rol `politica_canon_app`, el cual carece deliberadamente de privilegios `SELECT` o `UPDATE` en `email_outbox`.
- **REMEDIACIÓN:** Se creó en DDL el rol LOGIN `politica_canon_email_worker` asignado al grupo NOLOGIN `email_worker` (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`). Se le concedió `SELECT, UPDATE` en `email_outbox`. Se revocó `SELECT, UPDATE, DELETE` a `politica_canon_app` dejando únicamente `INSERT`. Se provisionó `EMAIL_WORKER_DATABASE_URL` y se verificó en la suite de integración con prueba negativa.

### C-02 — Provisión Completa de Servicios Systemd
- **FACT:** `provision.sh` solo instalaba `politica-canon.service`, dejando el worker autónomo sin servicio habilitado.
- **REMEDIACIÓN:** Se actualizó `deploy/scripts/provision.sh` para copiar, ejecutar `daemon-reload`, y habilitar/iniciar incondicionalmente ambas unidades systemd (`politica-canon.service` y `politica-canon-outbox-worker.service`).

### H-01 — Erradicación de Invocaciones HTTP al Outbox
- **FACT:** Las rutas de invitaciones y recuperación invocaban `processEmailOutbox(pool)` tras el `COMMIT` usando el pool web.
- **REMEDIACIÓN:** Se eliminaron las llamadas a `processEmailOutbox` en [src/auth/routes.ts](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/src/auth/routes.ts). Las rutas HTTP únicamente encolan registros en `email_outbox` dentro de su transacción activa.

### H-02 — Sanitización Terminal de Tokens Secreto
- **FACT:** Si un mensaje alcanzaba el estado `FAILED`, el token permanecía en texto claro.
- **REMEDIACIÓN:** Se actualizó `src/email/outbox.ts` para ejecutar la redacción `payload.token = '[REDACTED]'` tanto en transiciones a `SENT` como a `FAILED`.

### H-03 — Protocolo de Lease y Timeouts SMTP
- **FACT:** Las sentencias de actualización no comprobaban `locked_by` ni disponían de timeouts SMTP en Nodemailer.
- **REMEDIACIÓN:** Las sentencias UPDATE se condicionan estrictamente a `WHERE id = $... AND locked_by = $... AND status = 'PROCESSING'`. Se añadieron timeouts en Nodemailer (`connectionTimeout: 10s`, `greetingTimeout: 10s`, `socketTimeout: 15s`).

### H-04 — Validación DDL de Plantillas
- **FACT:** Una plantilla no reconocida fallaba silenciosamente y marcaba el registro como `SENT`.
- **REMEDIACIÓN:** Se añadió `CONSTRAINT email_outbox_template_check CHECK (template IN ('INVITATION', 'PASSWORD_RESET'))` en DDL y una rama `else` fail-closed que lanza excepción en el worker.

---

## 3. AUDITORÍA DE DISEÑO FRONTEND Y PRODUCTO (SECCIONES A - J)

Integrando las habilidades `design-taste-frontend` y `emil-design-eng` como lentes de análisis técnico y de UX sin alterar el código frontend ni la arquitectura existente durante la presente fase de auditoría.

### Jerarquía de Responsabilidades Aplicada

1. **Requerimientos de producto Política, comportamiento del dominio, semántica de datos y neutralidad política** (Prioridad Máxima Inviolable).
2. **Arquitectura existente de la aplicación, flujos de trabajo, permisos y contratos de API.**
3. **Sistema de diseño existente de Política, componentes reutilizables y tokens.**
4. **`design-taste-frontend`** (Criterio visual, densidad y composición).
5. **`emil-design-eng`** (Criterio de ingeniería de interacción, pulido y microinteracciones).

---

### A. Sistema de Diseño Frontend Existente

- **Arquitectura:** Monolito Fastify que sirve archivos estáticos desde `public/` y APIs JSON en `/api/v1/`.
- **Estructura HTML:** [public/index.html](file:///f:/politica-canon-v0.1.0/politica-canon-v0.1.0/public/index.html) utiliza HTML5 semántico básico (`<header>`, `<main>`, `<section>`, `<article>`).
- **Paleta de Colores y Tokens CSS:**
  - Fondo base: `#0d1117` (Oscuro calmo)
  - Fondo de tarjeta: `rgba(22, 27, 34, 0.85)` (Glassmorphism con blur de 16px)
  - Bordes: `rgba(48, 54, 61, 0.8)`
  - Texto principal: `#f0f6fc`
  - Texto secundario: `#8b949e`
  - Colores de acento de sistema: Azul (`#58a6ff`), Esmeralda (`#3fb950`), Ámbar (`#d29922`), Rojo (`#f85149`)
- **Tipografía:** Familia `Inter` con escala jerárquica estandarizada.
- **Componentes Observados:** Tarjetas flotantes (`.card`), badges de estado (`.header-badge`), tablas de miembros de organización, modales de diálogo flotantes, campos de entrada con borde redondeado.

---

### B. Elementos que Deben Preservarse

- **Tipografía Inter:** La jerarquía tipográfica actual es limpia, altamente legible y transmite sobriedad editorial.
- **Fondo Neutro Calmo (`#0d1117`):** Proporciona un espacio de trabajo operativo de bajo fatiga visual para usuarios que manejan datos políticos densos.
- **Tratamiento Equitativo de Datos:** Los listados de miembros e invitaciones mantienen un tratamiento visual estandarizado.

---

### C. Problemas Estructurales de UI

- **Patrón Repetitivo de Tarjetas Envolventes:** Prácticamente cada bloque de información se encierra en una tarjeta con borde y sombra (`.card`), generando fragmentación visual y poca flexibilidad de densidad.
- **Densidad de Información Inconsistente:** Grandes espacios en blanco en formularios frente a tablas muy apretadas sin padding proporcional.
- **Ausencia de Revelación Progresiva (Progressive Disclosure):** Se muestra toda la información técnica de una vez en lugar de permitir explorar detalles mediante paneles contextuales o drawers.

---

### D. Hallazgos Bajo el Lente de `design-taste-frontend` (Visual)

- **SaaS Genérico IA:** Presencia de gradientes decorativos de fondo y efectos glassmorphism que no aportan valor operativo a una aplicación de gobernanza política.
- **Exceso de Badges en Forma de Píldora:** Uso desmedido de cápsulas de colores para estados simples, saturando visualmente las tablas de miembros.
- **Sobredimensionamiento de Titulares:** Los encabezados de sección compiten en jerarquía con los datos clave del flujo.
- **Anidamiento Excesivo de Contenedores:** Paneles dentro de tarjetas dentro de modales que resta espacio útil para visualizar información operativa compleja.

---

### E. Hallazgos Bajo el Lente de `emil-design-eng` (Ingeniería de Interacción)

- **Falta de Feedback al Presionar (`Active States`):** Los botones carecen de respuesta táctil o de escala física al ser cliqueados o pulsados.
- **Transiciones de Modal Tosca:** La apertura y cierre de modales ocurre de forma abrupta, sin curvas de animación (easing) ni soporte para `prefers-reduced-motion`.
- **Estados Deshabilitados Ambiguos:** Los botones deshabilitados durante peticiones asíncronas solo cambian opacidad, sin comunicar progreso o spinner accesible.
- **Continuidad de Navegación Ausente:** No existen indicadores visuales de foco ni de transición entre pasos de confirmación.

---

### F. Hallazgos de Accesibilidad (Priorizados)

1. **CRITICAL — Anillo de Enfoque Teclado Ausente:** Los elementos interactivos (`button`, `input`) no disponen de estilos `:focus-visible` contrastados para usuarios de navegación por teclado.
2. **HIGH — Estructura Modal sin Atributos ARIA:** Los diálogos flotantes no implementan `role="dialog"`, `aria-modal="true"` ni atrapado de foco (`focus trap`).
3. **HIGH — Contraste de Texto Secundario:** El color `--text-muted` (`#8b949e`) no alcanza el ratio WCAG AA (4.5:1) sobre algunos fondos de tarjeta.
4. **MEDIUM — Tamaños de Objetivo Táctil:** Botones de acción en tabla tienen alturas inferiores a 44px en vistas táctiles.

---

### G. Riesgos de Neutralidad Política

- **Regla Inviolable:** El frontend de Política no debe editorializar la información política.
- **Evaluación del Estado Actual:** No se observaron sesgos de color asociados a ideologías o partidos políticos en la UI auditada. Los colores azul, esmeralda, ámbar y rojo se emplean **exclusivamente** para estados del sistema (`ACTIVE`, `PENDING`, `WARNING`, `ERROR`).
- **Garantía Operativa:** Ninguna actualización futura de estilos o animaciones podrá otorgar prominencia visual a actores, partidos o fuentes en función de su sesgo o postura.

---

### H. Oportunidades de Consolidación de Componentes

- **Unificación de Botones (`Button Primitive`):** Consolidar variantes `primary`, `secondary`, `danger` y `ghost` en un único componente con tokens de estado.
- **Componente de Tabla de Alta Densidad (`DataTable`):** Estandarizar la visualización de datos con cabeceras fijas, ordenación y estados vacíos/de carga consistentes.
- **Primitiva de Diálogo Modal (`Dialog / Drawer`):** Sustituir el código modal ad-hoc por un componente reutilizable que gestione foco, accesibilidad y animaciones.

---

### I. Adaptabilidad Responsive y Densidad de Información

- **Escritorio / Laptop:** La densidad actual desaprovecha el ancho de pantalla al envolver todo en tarjetas centradas de 800px.
- **Dispositivos Móviles:** Apilar verticalmente tablas de datos complejas destruye la usabilidad. Se recomienda la transición a drawers contextuales y vistas en lista simplificada para pantallas táctiles.

---

### J. Secuencia de Remediación Frontend Sugerida (Para Fase Futura)

> [!NOTE]
> Esta secuencia representa la hoja de ruta recomendada para la siguiente fase. NO debe ejecutarse durante la presente fase de auditoría.

1. **Fase 1 (Arquitectura de Tokens):** Refactorizar `index.css` consolidando variables de color, tipografía, elevación y espaciado sin modificar HTML/JS.
2. **Fase 2 (Accesibilidad Crítica):** Implementar `:focus-visible`, atributos ARIA y focus-trap en modales.
3. **Fase 3 (Consolidación de Componentes):** Crear primitives reutilizables de `Button`, `Dialog` y `DataTable`.
4. **Fase 4 (Polish & Interacción Emil Design Eng):** Añadir microinteracciones, retroalimentación táctil, transiciones suaves de entrada/salida y soporte para `prefers-reduced-motion`.

---

## 4. Dictamen de Gobernanza y Conclusión

- **Merge a `main`:** NO AUTORIZADO (A la espera de evaluación humana independiente).
- **Creación de Tag `v0.3.24`:** NO AUTORIZADO.
- **Despliegue en Plesk:** NO AUTORIZADO.
- **Servidor de Producción:** Mantiene la versión operativa `v0.3.11` (baseline Git `v0.3.17`).
