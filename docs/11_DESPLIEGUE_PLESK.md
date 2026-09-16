# Despliegue inicial en Plesk

## Entornos

- `local`: desarrollo con datos sintéticos.
- `staging`: URL provisional, pruebas de aceptación y contenido no sensible.
- `production`: miembros reales y contenido institucional.

No usar staging como producción informal.

## Diseño propuesto

- Docker Compose gestionado desde el servidor cuando la licencia/configuración de Plesk lo permita.
- Proxy inverso y TLS administrados por Plesk.
- Servicios: web, API, worker, PostgreSQL, Redis y almacenamiento compatible o servicio externo.
- Base de datos y Redis no expuestos públicamente.
- Archivos persistentes fuera de contenedores efímeros.

## Dominio provisional

- Usar subdominio técnico no promocionado.
- Bloquear indexación mediante cabeceras y autenticación; `robots.txt` no es un control de acceso.
- Certificado TLS válido desde el primer despliegue.
- Lista de orígenes permitidos y cookies vinculadas al host correcto.

## Checklist antes de usuarios reales

- DNS/TLS, correo transaccional y SPF/DKIM/DMARC.
- Backups de base y archivos, cifrados y restauración probada.
- Secretos separados por entorno.
- MFA y cuenta de emergencia protegida.
- Monitorización, alertas y logs con retención.
- Política de privacidad, términos internos y consentimiento/avisos necesarios.
- Escaneo de dependencias y prueba de autorización.
- Plan de actualización, rollback e incidentes.

## Migración al dominio definitivo

Inventariar URLs absolutas, callbacks, CORS, cookies, correo, almacenamiento, integraciones y canonical públicos. Probar el nuevo dominio antes del cambio y mantener redirecciones solo para rutas que puedan ser públicas.

