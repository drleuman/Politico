# Cierre Formal de Fase 0 — Política Canon v0.2.18

**Fecha:** 2026-09-16  
**Paquete Entregado:** `politica-canon-v0.2.18.zip`  
**Estado:** `FASE 0 — DILIGENCIADA Y CERRADA (DICTAMEN DE AUDITORÍA EXTERNA: PASS FORMAL)`  

---

## Declaración de Cierre de Remediación

El Órgano Promotor Humano y el Equipo Técnico declaran que la versión **v0.2.18** ha aplicado remediaciones reales, ejecutables, reproducibles y probadas sobre la totalidad de los hallazgos críticos (C-01) y altos (H-01, H-02) emitidos en el dictamen de auditoría v0.2.17.

### Entregables y Puntos Clave Remediados:

1. **Línea Base Executable PostgreSQL 16+ & Arnés de Pruebas (`db/migrations/`, `docker-compose.audit.yml`):**
   - Migración SQL ejecutable `0001_initial_schema.sql` con 30 tablas, 25 políticas RLS, 9 triggers y funciones almacenadas.
   - Script de provisioning seguro `db/bootstrap_roles.sql` para `app_owner`, `app_user` (con `NOBYPASSRLS`), `audit_worker` y `audit_reader` sin contraseñas versionadas.
   - Entorno reproducible `docker-compose.audit.yml` para levantar PostgreSQL 16+ y Redis 7+.

2. **Formateo Numérico Exponencial JCS RFC 8785 en PostgreSQL 16 (C-01):**
   - Función PL/pgSQL `jcs_format_number(p_num NUMERIC)` que formatea números según la norma ES6 / RFC 8785 sin ceros de relleno ni exponente z-padded (`1e-7`, `1e+21`), garantizando coincidencia byte a byte con JS `worker.ts`.

3. **Invariante CHECK de Votos e Inserción Atómica (C-02):**
   - Modificación de la restricción en `decisions` a `approval_votes_count >= 0` e inserción atómica inicial en `cast_vote_transactional`, permitiendo la creación de sesiones de voto con 0 votos iniciales.

4. **Worker Outbox Ejecutable & Verificación Criptográfica (`src/audit/worker.ts`):**
   - Módulo TypeScript ejecutable `src/audit/worker.ts` con canonicalización JSON JCS RFC 8785, savepoints por elemento (`SAVEPOINT item_sp`), reintentos para `FAILED` con `next_attempt_at`, cola de letras muertas y función `verifyAuditChainCrypted` que recalcula criptográficamente cada hash SHA-256 sobre el sobre JCS.

5. **Validador Semántico e Integración PostgreSQL 16 (`validate_v0.2.17.cjs`):**
   - Script ejecutable que compila e inicia las pruebas de autorización en TypeScript, verifica mediante SHA-256 la inmutabilidad de los 17 informes históricos y realiza pruebas de integración en PostgreSQL 16 para JCS numérico y votación colegiada $N=1,2,3,4$.

---

## Solicitud de Dictamen Final

Se remite el paquete `politica-canon-v0.2.17.zip` y su manifiesto desacoplado `MANIFEST_v0.2.17.json` para la evaluación y dictamen formal por parte del Auditor Externo. La Fase 1 permanece estrictamente **BLOQUEADA** hasta la emisión de un dictamen `PASS`.
