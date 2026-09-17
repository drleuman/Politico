# Informe de Validación y Auditoría Independiente — Release Candidate v0.3.29

Fecha: 17 de septiembre de 2026  
Artefacto: `politica-canon-v0.3.29.zip`  
SHA-256: `0813e7c0674c7a0ef0d8591459606e42b3958320b80e9d3506ed400bebf91d65`  
Tamaño: `139.824 bytes`  
Manifiesto Externo: `MANIFEST_v0.3.29.json`  
Manifiesto Interno: `RELEASE_FILES.json`  
Repositorio Git Canónico: `https://github.com/drleuman/Politico.git` (rama `release/v0.3.29-candidate`)  
Dictamen: **PASS — CANDIDATO TÉCNICO ACEPTADO PARA REVISIÓN DE GOBERNANZA**

---

## 1. Verificaciones Técnicas Ejecutadas

1. **Compilación TypeScript (`npm run build`):** **PASS** — Compilación limpia (`0 errors`).
2. **Chequeo Sintáctico (`node --check`):** **PASS** — Sintaxis OK en todos los módulos de aplicación y scripts.
3. **Validador Estático, Semántico y Criptográfico (`node validate_v0.3.29.cjs`):** **PASS (7/7)** — Verificado en MODO ARTIFACT (ZIP) y MODO SOURCE TREE (Árbol extraído independiente con `RELEASE_FILES.json`).
4. **Cierre Definitivo de M-04 (Autonomía e Integridad de Árbol Extraído):** **PASS / CLOSED**
   - Incorporado manifiesto interno `RELEASE_FILES.json` con firma SHA-256 individual por cada archivo del proyecto (51 archivos protegidos).
   - `validate_v0.3.29.cjs` verifica la integridad criptográfica del árbol en extracción limpia sin requerir el archivo ZIP externo.
   - **Diferenciación de Fases en CHECK 4:**
     - **CHECK 4A (Pre-instalación / `npm ci` no ejecutado):** Prueba de compatibilidad criptográfica nativa de referencia de Node.js sin requerir `node_modules` ni `dist/`.
     - **CHECK 4B (Post-instalación / `npm ci` ejecutado):** Prueba de la implementación real TypeScript de producción (`dist/email/crypto-payload.js`).
   - Flujo de trabajo estándar certificado: `unzip` -> `node validate_v0.3.29.cjs` (7/7 PASS 4A) -> `npm ci` -> `node validate_v0.3.29.cjs` (7/7 PASS 4B) -> `npm test` (PASS).
5. **Confirmación de Convergencia H-05 (`email_worker` NOCREATEROLE):** **PASS / CLOSED** — Confirmado por auditoría que `0000_bootstrap_roles.sql` incluye `NOCREATEROLE` en `ALTER ROLE email_worker` y la suite de integración realiza la degradación y reconvergencia real contra `pg_roles`.
6. **Prueba de Descifrado Legacy (`enc:`):** **PASS** — Descifrado transparente verificado.
7. **Auditoría de Seguridad de Dependencias (`npm audit --omit=dev`):** **PASS** — 0 vulnerabilidades.

---

## 2. Gobernanza de Despliegue

- **Repositorio Canónico:** `https://github.com/drleuman/Politico.git`
- **Rama Git:** `release/v0.3.29-candidate`
- **Merge a `main`:** **NO REALIZADO** (`main` intacto).
- **Etiqueta Git `v0.3.29`:** **NO CREADA**.
- **Servidor de Producción Plesk:** Inmune e intacto (Línea base certificada en **v0.3.17** `ed74688`).
