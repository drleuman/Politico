# Matriz de Remediación y Resolución de Hallazgos — Release v0.3.2

**Fecha:** 16 de septiembre de 2026  
**Auditoría Origen:** Auditoría Externa de Release `v0.3.1`  
**Estado General:** **REMEDIADO 100% — RELEASE v0.3.2 APROBADO Y LISTO PARA DESPLIEGUE EN PLESK**

---

## Matriz Resumen de Hallazgos y Correcciones Exigidas

| ID Hallazgo | Descripción / Evidencia Auditada | Impacto Identificado | Corrección Aplicada en Release v0.3.2 | Estado |
|---|---|---|---|---|
| **C-01** | Orden imposible entre bootstrap y migración (tablas no existían al cambiar propiedad). | Fallo en la aplicación del script de bootstrap inicial. | Se separó la secuencia en 3 fases independientes e idempotentes: Fase 1 Pre-Bootstrap (`db/0000_bootstrap_roles.sql`), Fase 2 Migración DDL (`db/migrations/0001_initial_schema.sql`) y Fase 3 Post-Bootstrap (`db/0002_bootstrap_permissions.sql`). | **REMEDIADO** |
| **C-02** | La identidad runtime `politica_canon_app` no estaba alineada con `app_user` ni comprobaba RLS. | Riesgo de conectar como rol superusuario o con bypass RLS. | Se concedió `GRANT app_user TO politica_canon_app;` con `NOBYPASSRLS` y se añadió aserción estricta de arranque en `src/db/client.ts` que valida `is_superuser = false` y `bypass_rls = false`. | **REMEDIADO** |
| **H-01** | Ejecución de bootstrap no funcionaba por autenticación TCP/contraseña en `postgres`. | Fallo al invocar `bootstrap` en servidor Ubuntu local. | Se configuró el uso predeterminado de socket Unix local (`postgresql:///?host=/var/run/postgresql`) para ejecución como usuario Unix `postgres` y comprobación de `usesuper = true`. | **REMEDIADO** |
| **H-02** | Provisión de secretos escribía `<RELLENAR_PASSWORD>` en blanco. | Servicio no podía arrancar tras provisión nominal. | Se actualizó `deploy/scripts/provision.sh` para derivar la contraseña real de `/root/politica-canon/runtime.env` si existe. | **REMEDIADO** |
| **H-03** | Portada HTML presentaba formulario simulado cuando la autenticación era por Nginx. | Confusión sobre el nivel de autenticación. | Se eliminó el formulario simulado de `public/index.html`, dejando una portada limpia protegida por `auth_basic` Nginx. | **REMEDIADO** |
| **H-04** | Descripción del servicio systemd desactualizada a `v0.3.0`. | Desalineación de metadatos de artefacto. | Se actualizó `deploy/systemd/politica-canon.service` con la descripción oficial `v0.3.2`. | **REMEDIADO** |
