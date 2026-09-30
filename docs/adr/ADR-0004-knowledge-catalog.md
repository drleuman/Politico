# ADR-0004 — Catálogo privado de conocimiento

Fecha: 2026-09-30. Estado: PROPUESTO (incremento técnico; no cambia reglas ratificadas).

## Contexto

El dashboard alpha.6 muestra identidad y operación, pero todavía no ofrece acceso a espacios ni documentos. El roadmap define conocimiento y documentos como Fase 2. El esquema ya incluye workspaces, documents y working_drafts.

## Implementación propuesta

Añadir un módulo knowledge al monolito, empezando por consulta privada de metadatos con sesión, RLS transaccional y el evaluador canónico READ. Usar exclusivamente la organización de la sesión y membresías activas. ADMIN no adquiere permisos editoriales. El catálogo no expone contenido ni recursos PUBLICO hasta disponer de un contrato verificable de publicación activa.

## Consecuencias

No requiere migración para este incremento. Lote inicial acotado a 100 candidatos, sin total ni paginación; puede devolver menos resultados tras autorización. La UI y las pruebas de integración real son requisitos antes del despliegue. El editor requerirá revisar almacenamiento de versiones inmutables, validación AST, OCC y outbox antes de escribir datos.

## Validación

10 pruebas de autorización: lectura interna, organización ajena, espacio ajeno, ADMIN sin membresía, MFA ausente/caducado, asignación nominal, clasificación pública y minimización del DTO. Tipos, build y test:security aprobados. No se certifica aquí ejecución de consultas en PostgreSQL real.
