# Informe de Validación Técnica — Release Candidate v0.3.21

**Fecha:** 17 de septiembre de 2026  
**Rama Git:** `release/v0.3.21-candidate`  
**Línea Base Git Certificada:** Tag `v0.3.17` (commit `ed74688`)  
**Instancia Productiva (Servidor Live):** Versión `v0.3.11` (Plesk / Ubuntu 24.04)  
**Dictamen:** `PASS` (FASE 1.1 FUNCIONAL REMEDIADA CERTIFICADA)

---

## 1. Resumen Ejecutivo

El release candidato `v0.3.21` resuelve de forma integral los hallazgos críticos (C-01 a C-04), altos (H-01 a H-04) y medios identificados en la auditoría del candidato `v0.3.20`.

### Artefactos Producidos
* **Archivo ZIP Candidato:** `politica-canon-v0.3.21.zip`
* **Manifiesto Externalizado:** `MANIFEST_v0.3.21.json`
* **Matriz de Remediación:** `REMEDIATION_MATRIX_v0.3.21.md`
* **Script de Validación Estática:** `validate_v0.3.21.cjs`

---

## 2. Resultados de las Comprobaciones de Validación

### Controles Estáticos y de Integridad (7/7 PASS)

1. **Cotejo Criptográfico e Integridad Física del Artefacto (H-03):** `PASS`  
   El validador calcula y coteja el hash SHA-256, tamaño de bytes y recuento de inventario del archivo `politica-canon-v0.3.21.zip`.
2. **Verificación de Esquema SQL en PGlite (C-02):** `PASS`  
   La tabla `organization_memberships` contiene exactamente las 6 columnas válidas (`organization_id`, `user_id`, `is_active`, `valid_from`, `valid_until`, `joined_at`) sin referencias a `role` ni `updated_at`.
3. **Erradicación de Cookie Heredada `sid` (H-01):** `PASS`  
   `extractSessionToken()` exige la cookie HttpOnly `__Host-sid` y rechaza peticiones con `sid`.
4. **Corrección SQL de `PATCH /api/v1/users/:id/status` (C-02):** `PASS`  
   Se realiza el JOIN con `role_assignments` para verificar la jerarquía de roles sin alterar el esquema de membresía.
5. **Fidelidad de Reversión en `0005_down.sql` (H-02):** `PASS`  
   El script restaura explícitamente las políticas RLS previas y elimina los índices.
6. **Coherencia de Metadatos de Release (M-01 & H-04):** `PASS`  
   `package.json`, `provision.sh` y scripts mantienen la versión unificada `0.3.21`.
7. **Pruebas de Integración con SMTP Mailpit Real y MFA E2E (C-04):** `PASS`  
   El runner `scripts/test-integration-pg16.mjs` ejecuta entregas SMTP reales contra Mailpit (puerto 11025), extrae tokens desde su API REST y valida el ciclo E2E completo de MFA.

---

## 3. Estado de Gobernanza

* **Rama `main`:** Sin modificaciones ni merge.
* **Tag `v0.3.21`:** Pendiente de autorización tras auditoría independiente.
* **Servidor de Producción:** Permanece intacto en versión `v0.3.11`.
