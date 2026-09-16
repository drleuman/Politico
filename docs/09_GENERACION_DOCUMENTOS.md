# Generación de documentos y publicaciones

## Principio

Un PDF o DOCX final debe ser una representación determinista de una versión congelada, no una captura del estado cambiante del editor.

## Flujo

1. Seleccionar una versión `APROBADO`.
2. Resolver citas, anexos, tablas, figuras y metadatos.
3. Validar enlaces rotos, numeración y fuentes requeridas.
4. Renderizar mediante plantilla versionada.
5. Ejecutar QA automático y visual.
6. Calcular hash del artefacto.
7. Guardar artefacto, plantilla, motor, fecha y parámetros.
8. Publicar manualmente si existe autorización.

## Contenido de salida

- Portada y estado institucional.
- Identificador, versión y fecha.
- Autores, revisores y órgano aprobador cuando corresponda.
- Resumen ejecutivo e índice.
- Cuerpo, notas, bibliografía y anexos.
- Declaración metodológica y limitaciones.
- Página de control con hash, historial y URL verificable opcional.

## Requisitos

- Tipografías embebidas o sustitución controlada.
- Etiquetas, orden de lectura, contraste y texto alternativo cuando el formato lo admita.
- Tablas que no pierdan encabezados y gráficos con resumen textual.
- Paginación y referencias cruzadas estables.
- Pruebas visuales con documentos cortos, largos, tablas amplias y contenido multilingüe.

