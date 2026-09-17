# Informe de Validación Técnica — Release Candidate v0.3.22

**Fecha:** 17 de septiembre de 2026  
**Resultado Global:** **PASS (7/7 CONTROLES SUPERADOS)**  

---

## 1. Resultados de Verificación Mecánica y Semántica

1. **`node validate_v0.3.22.cjs`**: **PASS (7/7)** — Verificación fail-closed de archivo ZIP físico, SHA-256, conteo de entradas, raíz interna, higiene, PGlite DDL, erradicación de cookie `sid`, evaluación multi-rol, rollback 0005_down y metadatos de versión.
2. **`npm audit --omit=dev --audit-level=high`**: **PASS** — 0 vulnerabilidades conocidas.
3. **`npm run build`**: **PASS** — Compilación TypeScript limpia.
4. **`node scripts/test-integration-pg16.mjs`**: **PASS** — Suite completa con PostgreSQL 16, Redis 7 y Mailpit SMTP real (outbox transaccional, reset-password E2E con revocación de sesión, jerarquía WRITER+ADMIN, rate limit MFA).

---

## 2. Garantías de Seguridad

- **Outbox Transaccional (C-03):** Sin operaciones de red bloqueantes dentro de las transacciones HTTP de base de datos.
- **Revocación de Sesiones Atómica (C-01):** Revocación incondicional vía función `SECURITY DEFINER` al restablecer contraseña.
- **Protección Jerárquica Completa (C-02):** Bloqueo a actores no-admin ante objetivos que posean el rol `ADMIN` entre sus múltiples asignaciones.
- **Validador Estricto (H-01):** Comprobación fail-closed que aborta si faltan artefactos físicos.
