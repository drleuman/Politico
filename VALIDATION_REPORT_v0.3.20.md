# Informe de Validación Técnica — Release Candidate v0.3.20

**Fecha de Emisión:** 17 de septiembre de 2026  
**Rama Git:** `release/v0.3.20-candidate`  
**Dictamen General:** PASS — REMEDIADO Y CERTIFICADO PARA AUDITORÍA  

---

## 1. Resumen Ejecutivo

El candidato `v0.3.20` resuelve la totalidad de los hallazgos críticos (C-01 a C-04) y altos (H-01 a H-04) identificados en la auditoría previa. 

---

## 2. Metadatos del Paquete y Manifiesto

* **Archivo ZIP:** `politica-canon-v0.3.20.zip`
* **Manifiesto Externalizado:** `MANIFEST_v0.3.20.json`
* **Motor Canónico BD:** PostgreSQL 16+
* **Servicio Redis:** Redis 7
* **Servicio SMTP:** Mailpit / Transporte SMTP Estándar

---

## 3. Matriz de Cobertura de Pruebas Executadas

1. **Aislamiento RLS Transaccional (C-01):** Garantizado mediante bloques `BEGIN ... COMMIT/ROLLBACK` en cada solicitud tenant-aware.
2. **Corrección de Columnas de Membresía (C-02):** Roles consultados desde `role_assignments` y estado en `organization_memberships.is_active`.
3. **Rollback Compensatorio SMTP (C-03):** Operación transaccional unificada con anulación de auditoría y registros ante fallos de correo.
4. **Pruebas de Integración con SMTP Real (C-04):** Integración con Mailpit en `docker-compose.audit.yml` y prueba completa del ciclo MFA.
