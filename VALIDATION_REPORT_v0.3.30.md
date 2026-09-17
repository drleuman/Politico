# Informe de Validación y Auditoría Independiente — Release Candidate v0.3.30 (Inmutable)

Fecha: 17 de septiembre de 2026  
Artefacto Canónico: `politica-canon-v0.3.30.zip`  
Estado Versión Previa: `v0.3.29` declarada **SUPERSEDED / VOID** (anulada por regeneración post-certificación).  
SHA-256: `f816e03130686c1bef5f1615da2f46e7f85dcb90ed3e375406e518b2460cbc2b`  
Tamaño: `140.096 bytes`  
Manifiesto Externo: `MANIFEST_v0.3.30.json`  
Manifiesto Interno: `RELEASE_FILES.json`  
Repositorio Git Canónico: `https://github.com/drleuman/Politico.git` (rama `release/v0.3.30-candidate`)  
Dictamen: **PASS — CANDIDATO TÉCNICO INMUTABLE CERTIFICADO PARA REVISIÓN DE GOBERNANZA**

---

## 1. Verificaciones Técnicas Ejecutadas

1. **Compilación TypeScript (`npm run build`):** **PASS** — Compilación limpia (`0 errors`).
2. **Chequeo Sintáctico (`node --check`):** **PASS** — Sintaxis OK en todos los módulos de aplicación y scripts.
3. **Validador Estático, Semántico y Criptográfico (`node validate_v0.3.30.cjs`):** **PASS (7/7)** — Verificado en MODO ARTIFACT (ZIP) y MODO SOURCE TREE (Árbol extraído independiente con `RELEASE_FILES.json`).
4. **Cierre Definitivo de M-04 (Autonomía e Integridad de Árbol Extraído):** **PASS / CLOSED**
   - Incorporado manifiesto interno `RELEASE_FILES.json` con checksums SHA-256 individuales por cada uno de los 51 archivos protegidos del proyecto.
   - `validate_v0.3.30.cjs` verifica la integridad criptográfica de todo el árbol en extracción limpia sin depender del archivo ZIP externo.
   - **Diferenciación de Fases en CHECK 4:**
     - **CHECK 4A (Modo pre-instalación de referencia):** Verificación autónoma mediante motor nativo de Node.js `crypto` sin requerir `node_modules` ni `dist/`.
     - **CHECK 4B (Modo con implementación compilada de producción):** Verificación ejecutando el módulo compilado TypeScript `dist/email/crypto-payload.js`.
   - Flujo de trabajo estándar certificado: `unzip` -> `node validate_v0.3.30.cjs` (7/7 PASS 4A) -> `npm ci` -> `node validate_v0.3.30.cjs` (7/7 PASS 4B) -> `npm test` (PASS).
5. **Confirmación de Convergencia H-05 (`email_worker` NOCREATEROLE):** **PASS / CLOSED** — Confirmado por auditoría que `0000_bootstrap_roles.sql` incluye `NOCREATEROLE` en `ALTER ROLE email_worker` y la suite de integración realiza la degradación y reconvergencia real contra `pg_roles`.
6. **Prueba de Descifrado Legacy (`enc:`):** **PASS** — Descifrado transparente verificado.
7. **Auditoría de Seguridad de Dependencias (`npm audit --omit=dev`):** **PASS** — 0 vulnerabilidades.

---

## 2. Gobernanza de Despliegue e Inmutabilidad

- **Inmutabilidad de Release:** La versión `v0.3.29` queda anulada (**SUPERSEDED / VOID**) para evitar ambigüedades por regeneración de hash. `v0.3.30` constituye el único Release Candidate inmutable.
- **Repositorio Canónico:** `https://github.com/drleuman/Politico.git`
- **Rama Git:** `release/v0.3.30-candidate`
- **Merge a `main`:** **NO REALIZADO** (`main` intacto).
- **Etiqueta Git `v0.3.30`:** **NO CREADA**.
- **Servidor de Producción Plesk:** Inmune e intacto (Línea base certificada en **v0.3.17** `ed74688`).
