# Criterios de aceptación del MVP

## Identidad y acceso

- Una persona sin invitación válida no puede crear cuenta en el entorno privado.
- Una cuenta desactivada pierde acceso y sus sesiones son revocadas.
- Los roles sensibles requieren MFA.
- Las pruebas intentan acceso horizontal, vertical y entre espacios.

## Documentos y evidencia

- Dos versiones pueden compararse y una versión anterior puede restaurarse como nueva versión.
- Una cita conserva fuente y localización concreta.
- Un cambio posterior no altera una versión revisada o aprobada.
- Los comentarios anclados sobreviven o se marcan como desanclados tras cambios.

## Gobernanza

- Las transiciones inválidas son rechazadas por la API.
- No se puede aprobar una versión que no haya completado las revisiones requeridas.
- Se registran autoridad, quórum/regla, recusaciones, resultado y versión.
- Se distingue la aprobación del acto posterior de publicación.

## Dashboards

- Cada gráfico muestra fuente, periodo, unidad y fecha de actualización.
- Los permisos se aplican antes de consultas, agregaciones y exportaciones.
- La tabla accesible contiene los mismos valores que la visualización.

## Exportaciones

- Solo se exporta la versión solicitada y autorizada.
- PDF y DOCX incluyen identificador, versión y fecha.
- El sistema conserva el hash y parámetros de cada artefacto final.
- Los casos de prueba visual no presentan cortes, solapamientos ni referencias rotas.

## Operación

- Existe una restauración probada de base de datos y archivos.
- Un despliegue fallido puede revertirse sin pérdida de datos.
- Alertas cubren errores, saturación, fallos de trabajos y cambios sensibles.
- Logs y auditoría evitan secretos y contenido confidencial innecesario.

