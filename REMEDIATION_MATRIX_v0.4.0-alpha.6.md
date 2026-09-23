# Matriz de remediación — v0.4.0-alpha.6

Origen: auditoría independiente del artefacto `v0.4.0-alpha.4` (SHA-256 `77d8c75f5efe8a6085e397d40f8cd2387e4213346869b543760acc2d476de1be`).

| ID | Hallazgo | Remediación | Prueba |
|---|---|---|---|
| C-01 | Descifrado outbox fail-open | Validación estricta de envelope AES-GCM y excepción estable `PAYLOAD_DECRYPTION_FAILED`; el procesamiento captura el error antes de SMTP y conserva reintentos. | `test-security-regressions.mjs`: clave incorrecta, envelope corrupto, cero correos enviados. |
| C-02 | Escalada a `ADMIN` mediante invitación | Matriz de delegación por rol actor. `ADMIN` delega `COORDINATOR/WRITER/REVIEWER`; `COORDINATOR` solo `WRITER/REVIEWER`. | Pruebas unitarias y caso adversarial HTTP 403 en integración real. |
| C-03 | XSS almacenado en perfil | Sustitución de interpolación `innerHTML` por `createElement`, `textContent` y `dl` semántico. | Validador prohíbe asignaciones `.innerHTML =` en frontend. |
| C-04 | `pg` ausente con `--omit=dev` | `pg` trasladado a `dependencies`. | Instalación productiva aislada y resolución de módulo comprobada. |
| C-05 | Bootstrap invocaba Drizzle inexistente | Restaurados `bootstrap:pre`, `migrate:prod`, `bootstrap:post`; eliminado Drizzle de scripts productivos. | Validador comprueba comandos exactos y archivos. |
| C-06 | Servicios habilitados antes de migraciones | Provisión solo instala unidades; `activate-release.sh` hace backup, 3 fases, preflight, enable/start y probes. | `bash -n` y comprobaciones estructurales 11/11. |
| C-07 | Roles frontend inválidos | Selector alineado con enums uppercase y sin opción `ADMIN`. | Regresión estática y pruebas de matriz RBAC. |
| H-01 | Metadatos obsoletos | Metadatos activos sincronizados a `v0.4.0-alpha.6`. | Validador recorre los artefactos activos. |
| H-02 | README roto/obsoleto | README autocontenido reescrito y manual de despliegue añadido. | Cero enlaces locales rotos en documentación activa. |
| H-03 | SMTP listo sin remitente | `isEmailConfigured()` exige host, puerto y `SMTP_FROM`. | Validador estático y preflight SMTP real. |
| H-04 | `/readyz` revelaba error DB | Eliminado `dbError` de la respuesta HTTP. | Revisión de respuesta y compilación. |
| C-08 | Checksum productivo roto por normalización CRLF→LF | Restaurados los bytes certificados de `0003/0004`, atributos binarios en Git y hashes fijados en el validador. | SHA-256 exacto contra producción y prueba desde clon limpio. |

## Estado

Las remediaciones están implementadas y verificadas. El gate completo `npm test` obtuvo **PASS** en GitHub Actions (ejecución `35808205424`) con Docker, PostgreSQL 16, Redis 7 y Mailpit reales. El candidato puede avanzar a empaquetado final y revisión por Pull Request; no autoriza por sí mismo merge, tag, release ni despliegue productivo.
