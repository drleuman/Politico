# Acta Fundacional del Producto

**Versión:** `0.2.1`  
**Estado:** `RATIFICADO EN FASE 0`  
**Referencia de Ratificación:** [`ACTA-2026-001`](00_ACTA_RATIFICACION_FASE_0.md)  
**Fecha de Ratificación:** 2026-09-15  

---

## 1. Misión

Facilitar una elaboración plural, documentada, trazable y segura de diagnósticos, alternativas y propuestas para un posible modelo federal de Bolivia, preservando el debate interno y permitiendo generar publicaciones institucionales reproducibles.

---

## 2. Resultado Esperado

Una fuente institucional de conocimiento donde cada afirmación relevante pueda rastrearse a evidencia, cada modificación a una persona autenticada y cada posición oficial a una decisión formal irrevocablemente firmada sobre una versión inmutable.

---

## 3. Alcance Inicial

- Gestión multi-tenant de organizaciones, espacios temáticos/territoriales, usuarios, roles e invitaciones.
- Biblioteca de fuentes y fichas de evidencia con pasajes y niveles de calidad (A-D).
- Editor rico (`WorkingDraft`) con comentarios anclados y versión inmutable congelada (`DocumentVersion`).
- Expedientes de propuesta, revisiones sectoriales, votaciones, decisiones y actas institucionales.
- Dashboards con indicadores citables, series históricas y notas metodológicas.
- Generación determinista de PDF y DOCX desde versiones congeladas con hash SHA-256.
- Búsqueda con permisos evaluados en servidor, notificaciones y auditoría *append-only*.
- Administración técnica de infraestructura, copias de seguridad out-of-band y observabilidad.

---

## 4. Fuera de Alcance Inicial

- Campañas electorales y publicidad política.
- Perfilado ideológico de ciudadanos o microsegmentación.
- Donaciones, afiliación legal o censo electoral.
- Votación pública vinculante.
- Automatización de decisiones políticas mediante IA (la IA no posee autoridad ni rol en el sistema).
- Publicación automática en redes sociales.

---

## 5. Principios Fundamentales

1. **Legalidad y Derechos Fundamentales:** Respeto estricto del orden constitucional e internacional.
2. **Rigor de Fuentes y Honestidad Metodológica:** Ninguna cifra sin fuente, periodo y cobertura.
3. **Pluralidad Territorial, Cultural y Lingüística:** Aislamiento temático con diversidad de perspectivas.
4. **Seguridad y Privacidad desde el Diseño:** Denegación por defecto, minimización de datos y RLS.
5. **Trazabilidad e Inmutabilidad:** Inmutabilidad estricta de versiones revisadas, aprobadas y eventos de auditoría.
6. **Accesibilidad Universal:** Cumplimiento del estándar de accesibilidad web vigente (WCAG 2.1 AA).
7. **Control Humano Exclusivo:** Toda decisión institucional requiere la acción explicita de una autoridad humana identificada.

---

## 6. Acuerdos de Ratificación Formalizados

- **Órgano Promotor:** Autoridad colegiada humana encargada de la deliberación y firma de decisiones.
- **Roles de Gobernanza:** Separación estricta entre el `ADMIN` técnico (infraestructura) y las autoridades políticas (`APPROVER` / `PUBLISHER`).
- **Nivel de Confidencialidad por Defecto:** Los workspaces temáticos se crean como `INTERNO` por defecto.
