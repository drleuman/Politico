# Matriz de Remediación Técnica — Política Canon v0.3.18 (Fase 1.1 Funcional)

**Fecha:** 17 de septiembre de 2026  
**Rama:** `feature/fase-1.1-functional`  
**Versión Target:** `v0.3.18`  
**Estado:** **REMEDIADO 100% — APTO PARA CANDIDATURA DE AUDITORÍA**

---

## Hallazgos y Remediaciones

| ID | Severidad | Descripción del Requerimiento | Archivos Modificados | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **F11-01** | Crítico | **Fail-Closed de Invitaciones por Email:** Las invitaciones privadas deben enviarse por correo electrónico y no retornar el token en la respuesta REST JSON ni logs. Si el transporte no está configurado, la emisión debe fallar cerrada con HTTP 503. | [src/email/adapter.ts](src/email/adapter.ts), [src/auth/routes.ts](src/auth/routes.ts) | **PASS** |
| **F11-02** | Crítico | **Separación de Clave MFA (`MFA_MASTER_KEY`):** Los secretos TOTP deben cifrarse en reposo con AES-256-GCM y una clave independiente `MFA_MASTER_KEY` (mín. 32 caracteres) sin reutilizar `SESSION_SECRET`. | [src/config/env.ts](src/config/env.ts), [src/auth/routes.ts](src/auth/routes.ts), [src/auth/mfa.ts](src/auth/mfa.ts) | **PASS** |
| **F11-03** | Alto | **Gestión de Sesiones y Usuarios:** Implementar endpoints para listar y revocar sesiones individuales (`GET /api/v1/sessions`, `DELETE /api/v1/sessions/:id`) y para listar y desactivar/activar cuentas de usuario (`GET /api/v1/users`, `PATCH /api/v1/users/:id/status`). | [src/auth/session.ts](src/auth/session.ts), [src/auth/routes.ts](src/auth/routes.ts) | **PASS** |
| **F11-04** | Medio | **Migración Forward-Only `0005`:** Añadir migración `0005_fase_1_1_functional.sql` optimizando índices de sesiones, invitaciones y membresías, preservando checksums anteriores. | [db/migrations/0005_fase_1_1_functional.sql](db/migrations/0005_fase_1_1_functional.sql) | **PASS** |
| **F11-05** | Medio | **Interfaz de Usuario (SPA) Intranet Privada:** Construcción de UI Single Page Application en `public/index.html` con vistas sobrias, accesibles y dinámicas para Login, Aceptación, MFA, Perfil, Sesiones, Invitaciones y Usuarios. | [public/index.html](public/index.html) | **PASS** |
| **F11-06** | Medio | **Protección Anti-Enumeración:** Evitar la fuga de existencia de cuentas en login y recuperación mediante mensajes de error neutros e indistinguibles. | [src/auth/routes.ts](src/auth/routes.ts) | **PASS** |
| **F11-07** | Alto | **Verificación Integrada PG16 & Redis 7:** Ampliar suite `npm test` con pruebas adversariales de transporte de correo, step-up MFA, gestión de sesiones y control de acceso. | [scripts/test-integration-pg16.mjs](scripts/test-integration-pg16.mjs), [validate_v0.3.18.cjs](validate_v0.3.18.cjs) | **PASS** |
