# AGENTS.md — Instrucciones para Antigravity y agentes

## Misión

Construir y mantener una plataforma segura, auditable y profesional para investigación colaborativa, deliberación, edición y publicación de documentos relativos al proyecto de federalización de Bolivia.

## Orden de lectura

Antes de cambiar código o contenido: `CANON.md`, `docs/00_ACTA_FUNDACIONAL.md`, `docs/01_PRD.md`, el documento de dominio afectado y `docs/13_REGISTRO_DECISIONES.md`.

## Reglas obligatorias

1. No inventar datos, fuentes, consensos, aprobaciones ni citas.
2. Separar hechos, inferencias, escenarios, recomendaciones y decisiones.
3. No atribuir una posición oficial sin un registro `APROBADO`.
4. No publicar ni elevar estados editoriales sin acción humana autorizada.
5. Mantener historial, autoría, fuente, fecha de consulta y motivo de cada cambio.
6. Proteger datos personales, credenciales, deliberaciones privadas y documentos restringidos.
7. Aplicar mínimo privilegio y aislamiento por organización/espacio de trabajo.
8. No ejecutar migraciones destructivas ni operar sobre producción sin copia, plan de reversión y autorización explícita.
9. Añadir pruebas para permisos, flujos de estado, exportación y cambios de datos.
10. No realizar propaganda personalizada ni segmentación política basada en datos sensibles.

## Método de trabajo

- Inspeccionar antes de editar.
- Formular supuestos explícitos cuando falte información.
- Para cambios relevantes, crear o actualizar un ADR.
- Implementar el cambio mínimo coherente con la arquitectura.
- Ejecutar pruebas y registrar limitaciones.
- Actualizar documentación y changelog en el mismo cambio.
- No marcar una fase como completa sin cumplir sus criterios de aceptación.

## Definition of Done

- Requisito trazado a implementación.
- Autorización validada en servidor, no solo en interfaz.
- Pruebas automáticas relevantes aprobadas.
- Migración reversible cuando aplique.
- Eventos de auditoría generados.
- Accesibilidad y responsive verificados.
- Sin secretos ni datos reales en código, fixtures o logs.
- Documentación afectada actualizada.

## Convenciones técnicas propuestas

- TypeScript estricto.
- API versionada bajo `/api/v1`.
- UUID/ULID para identificadores internos; identificadores públicos canónicos separados.
- Validación de entrada y salida mediante esquemas.
- Tiempos en UTC; cantidades monetarias en unidades menores o decimal exacto.
- Borrado lógico para contenido gobernado; retención conforme a política aprobada.
- Logs estructurados con `request_id`, actor y espacio, sin contenido sensible.

## Límites de IA

La IA puede resumir, comparar, sugerir estructura, detectar inconsistencias y preparar borradores. Toda salida se etiqueta como asistida, conserva modelo/fecha/prompt o referencia de tarea cuando proceda, cita el corpus usado y requiere revisión humana antes de adquirir autoridad.

