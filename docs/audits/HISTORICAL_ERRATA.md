# Erratas y Trazabilidad Histórica de Auditorías Anteriormente Emitidas — Política Canon v0.2.8

**Estado:** `VIGENTE (RATIFICACIÓN HUMANA)`  
**Fecha:** 2026-09-15  
**Paquete:** `politica-canon-v0.2.8`  

---

## 1. Principio de Inmutabilidad de Registros Históricos

En cumplimiento estricto del canon de auditoría e inmutabilidad, **los registros históricos de remediación e informes de validación pasados (`REMEDIATION_MATRIX_v0.2.2.md` a `v0.2.7.md`, `VALIDATION_REPORT_v0.2.3.md` a `v0.2.7.md`) se conservan 100% intactos e inalterados byte por byte**.

Cualquier aclaración sobre expresiones o literales contenidos en dichos informes pasados se registra exclusivamente en este documento.

---

## 2. Notas de Trazabilidad y Aclaración de Expresiones

1. **Aclaración sobre Retornos Permisivos:** En versiones pasadas (v0.2.0 - v0.2.2), el evaluador retornaba la concesión de forma incondicional. En v0.2.8 el contrato exige denegación por defecto (`allowed = false`) y retorno tipado `{ allowed: boolean; grantReason?: string; denyReason?: string; requiresTransactionalExecution?: boolean }`.
2. **Aclaración sobre Hashing vs Cifrado:** Las menciones a "cifrado con SHA-256" en v0.2.2 fueron aclaradas como imprecisas. En v0.2.8, se usa **Argon2id** (hash lento) para códigos de respaldo y **AES-256-GCM** (Envelope Encryption) para secretos TOTP.
3. **Aclaración sobre Recuento de Tablas y Entidades:** El modelo borrador inicial mencionaba 21 tablas y luego 28 entidades. El modelo final **v0.2.8** consolida exactamente **29 Entidades Conceptuales Únicas** (incorporando `AUDIT_OUTBOX_DEAD_LETTER`) y **29 Tablas Físicas DDL** en PostgreSQL 16+.
4. **Aclaración sobre Políticas RLS Operativas:** En v0.2.6 se activaron 25 declaraciones `ENABLE ROW LEVEL SECURITY`, pero sólo se definió la política `CREATE POLICY` en `documents`. En **v0.2.8**, se definen explícitamente las 25 políticas `CREATE POLICY tenant_isolation_policy ON ... USING (...) WITH CHECK (...)` en `db/migrations/0001_initial_schema.sql`.
5. **Aclaración sobre Arnés de Pruebas y Código Entregado:** En v0.2.7 se incluyeron fragmentos de código en archivos Markdown. En **v0.2.8**, se entregan los archivos fuente compilables y ejecutables en `db/migrations/`, `db/bootstrap_roles.sql`, `docker-compose.audit.yml`, `src/audit/worker.ts` y `src/auth/authorization.ts`.
