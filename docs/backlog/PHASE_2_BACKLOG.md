# Fase 2 — Conocimiento y documentos

Estado: EN IMPLEMENTACIÓN. La fase no está certificada ni desplegada.

## 2A — Catálogo privado (primer incremento)

- Implementado `GET /api/v1/knowledge/catalog`: espacios asociados al usuario y metadatos de documentos privados visibles.
- Contexto de organización obtenido de la sesión; RLS local a la transacción y predicados explícitos de organización.
- Cada documento se evalúa con `evaluateAuthorizationContract(READ)` antes de devolver título o identificadores.
- ADMIN no sustituye membresía de workspace. Clasificaciones sensibles mantienen MFA reciente y asignación nominal conforme al canon.
- Respuesta no cacheable; sin contenido de borradores ni contadores de documentos denegados.
- Primer lote limitado a 100 documentos candidatos: no es un catálogo completo ni incluye paginación todavía.
- Pruebas locales: tipos, build, seguridad y 10 comprobaciones de autorización del catálogo aprobadas.
- Pendiente: integración real PostgreSQL 16/Redis 7, prueba HTTP autenticada, caducidad/revocación, UI accesible, paginación y verificación de índices antes de promover a producción.

## 2B — Espacios y acceso editorial

Crear/gestionar espacios con auditoría transaccional; asignaciones explícitas WRITER/COORDINATOR/REVIEWER. Sin concesión implícita de autoridad a ADMIN.

## 2C — Fuentes y evidencias

Biblioteca, URL bibliográfica, autor, fecha de consulta, pasajes, calidad y vínculo a afirmaciones. No descargar URLs arbitrarias desde el servidor sin política SSRF.

## 2D — Borrador y editor

Creación y edición con AST validado, límites de tamaño y revisión optimista. Conflicto concurrente devuelve 409; conservar autoría y outbox en la misma transacción.

## 2E — Historial y comentarios

Versiones reconstruibles, comentarios anclados y búsqueda filtrada en servidor. Comprobar capacidad de almacenar AST congelado: el esquema actual de document_versions solo declara hash y metadatos.

## Puerta de cierre

Un documento puede reconstruirse con fuentes, autores e historial. Pruebas negativas cross-tenant, rollback, permisos, conflictos y XSS aprobadas; accesibilidad revisada. Revisión/aprobación/publicación pertenecen a la Fase 3 y requieren acción humana.
