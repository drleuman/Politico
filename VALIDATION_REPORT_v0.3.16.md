# Reporte Formal de Validaciones — Release v0.3.16 (Fase 1.1 Correctiva)

**Fecha:** 16 de septiembre de 2026  
**Versión Auditada:** v0.3.16  
**Dictamen Técnico:** PASS  

---

## 1. Comprobaciones Estáticas y Estructurales (7/7 PASS)

El script de validación determinista [`validate_v0.3.16.cjs`](validate_v0.3.16.cjs) ha ejecutado las 7 comprobaciones canónicas requeridas:

1. **[PASS] Verificación de Enlaces Relativos Portables Markdown:** Inspeccionados todos los enlaces `.md` del repositorio, confirmando 0 enlaces rotos y 0 esquemas absolutos `file:///`.
2. **[PASS] Preservación Criptográfica Inmutable de Informes Históricos:** Verificada la integridad de los reportes anteriores (`v0.3.10` a `v0.3.15`).
3. **[PASS] Compilación TypeScript Estricta (`tsc --noEmit`):** 0 errores de compilación.
4. **[PASS] Coherencia de Metadatos y Verificación de Scripts en `package.json`:** Alineación exacta de versión `v0.3.16` en todos los artefactos y existencia física confirmada de los scripts de despliegue (`bootstrap:pre`, `migrate:prod`, `bootstrap:post`).
5. **[PASS] Modelo de Permisos Restringido 0750 / 0640 y Pertenencia a Grupo (B-02):** Permisos en archivos y pertenencia de `postgres` a grupo `politica-canon`.
6. **[PASS] Inicialización Basal PGlite con Migraciones 0003 y 0004:** Migraciones DDL aplicadas en secuencia limpia sin violaciones DML.
7. **[PASS] Inclusión Directa de Integración Real en `npm test`:** Presencia del runner de pruebas en Docker Compose (PostgreSQL 16 + Redis 7).

---

## 2. Resumen de Pruebas de Integración Real y Seguridad Catálogo PG16

- **Docker Compose PostgreSQL 16 & Redis 7:** 2 rondas de pre-bootstrap, migración DDL incremental (`0001` -> `0003` -> `0004`) y post-bootstrap.
- **Catálogo PostgreSQL 16 Real:**
  - `resolve_session_by_token`, `resolve_invitation_by_token`, `get_user_active_memberships` -> Propietario: `token_resolver`.
  - `token_resolver` -> `BYPASSRLS = true`, `CREATE ON SCHEMA public = false`.
  - `app_owner` -> Membresía en `token_resolver` = `false` (revocada).
- **Pruebas Adversariales de Seguridad:**
  - Resolución bajo `FORCE ROW LEVEL SECURITY` exitosa.
  - Exigencia MFA en invitaciones (crear, listar, revocar) sin MFA o con MFA vencido (>15 min) -> `403 Forbidden`.
  - Éxito con MFA activo y reciente (<15 min) -> `201 Created` / `200 OK`.
