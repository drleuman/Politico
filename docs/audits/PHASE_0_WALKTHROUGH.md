# Walkthrough de Verificación de Auditoría — Política Canon v0.2.17

**Estado:** `VIGENTE (RATIFICACIÓN HUMANA)`  
**Fecha:** 2026-09-16  
**Paquete:** `politica-canon-v0.2.17`  

---

## 1. Verificación de Puntos Críticos de Auditoría v0.2.17

1. **Línea Base Executable PostgreSQL 16+ & Arnés de Pruebas (`db/migrations/`, `docker-compose.audit.yml`):**
   - DDL ejecutable completo en `0001_initial_schema.sql` (30 tablas, 25 políticas RLS, 9 triggers anti-CASCADE).
   - Provisioning seguro `db/bootstrap_roles.sql` para `app_owner`, `app_user` (con `NOBYPASSRLS`), `audit_worker` y `audit_reader` sin contraseñas versionadas.
   - Entorno en contenedor `docker-compose.audit.yml` para PostgreSQL 16+ y Redis 7+.

2. **Formateo Numérico Exponencial JCS RFC 8785 en PostgreSQL 16 (C-01):**
   - Función PL/pgSQL `jcs_format_number(p_num NUMERIC)` sin ceros de relleno ni exponente z-padded (`1e-7`, `1e+21`), garantizando coincidencia byte a byte con JS `worker.ts`.

3. **Invariante CHECK de Votos e Inserción Atómica (C-02):**
   - Modificación del `CHECK` en `decisions` a `approval_votes_count >= 0` e inserción atómica inicial en `cast_vote_transactional`, permitiendo la creación de sesiones de voto con 0 votos iniciales.

4. **Worker Outbox Ejecutable & Verificación Criptográfica (`src/audit/worker.ts`):**
   - Módulo TypeScript ejecutable `src/audit/worker.ts` con canonicalización JSON JCS RFC 8785, savepoints por elemento (`SAVEPOINT item_sp`), reintentos para `FAILED` con `next_attempt_at`, cola de letras muertas y función `verifyAuditChainCrypted` que recalcula criptográficamente cada hash SHA-256 sobre el sobre JCS.

5. **Validador Semántico e Integración PostgreSQL 16 (`validate_v0.2.17.cjs`):**
   - Script ejecutable que compila e inicia las pruebas de autorización en TypeScript, verifica mediante SHA-256 la inmutabilidad de los 17 informes históricos y realiza pruebas de integración en PostgreSQL 16 para JCS numérico y votación colegiada $N=1,2,3,4$.

---

## 2. Enlaces Relativos de Referencia

- Matriz de Remediación v0.2.17: [`../../REMEDIATION_MATRIX_v0.2.17.md`](../../REMEDIATION_MATRIX_v0.2.17.md)
- Informe de Validación v0.2.17: [`../../VALIDATION_REPORT_v0.2.17.md`](../../VALIDATION_REPORT_v0.2.17.md)
- Script de Validación Incluido: [`../../validate_v0.2.17.cjs`](../../validate_v0.2.17.cjs)
- Aceptación Final y Solicitud de Auditoría Externa: [`../../PHASE_0_FINAL_ACCEPTANCE.md`](../../PHASE_0_FINAL_ACCEPTANCE.md)
