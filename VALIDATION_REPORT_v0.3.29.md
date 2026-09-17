# Informe de Validación y Auditoría Independiente — Release Candidate v0.3.29

Fecha: 17 de septiembre de 2026  
Artefacto: `politica-canon-v0.3.29.zip`  
SHA-256: `6177da60eed5b3dcc4aa20d924e75266bb74868af8befe2acab34020022be289`  
Tamaño: `139.512 bytes`  
Manifiesto Externo: `MANIFEST_v0.3.29.json`  
Manifiesto Interno: `RELEASE_FILES.json`  
Dictamen: **PASS (CERTIFICACIÓN COMPLETA DE REMEDIACIÓN DE M-04 E INTEGRIDAD DE ÁRBOLES EXTRAÍDOS)**

---

## 1. Verificaciones Técnicas Ejecutadas

1. **Compilación TypeScript (`npm run build`):** **PASS** — Compilación limpia (`0 errors`).
2. **Chequeo Sintáctico (`node --check`):** **PASS** — Sintaxis OK en todos los módulos de aplicación y scripts.
3. **Validador Estático, Semántico y Criptográfico (`node validate_v0.3.29.cjs`):** **PASS (7/7)** — Verificado en MODO ARTIFACT (ZIP) y MODO SOURCE TREE (Árbol extraído independiente con `RELEASE_FILES.json`).
4. **Cierre Definitivo de M-04 (Autonomía e Integridad de Árbol Extraído):** **PASS**
   - Incorporado manifiesto interno `RELEASE_FILES.json` con firma SHA-256 individual por cada archivo del proyecto.
   - `validate_v0.3.29.cjs` verifica la integridad criptográfica de todo el árbol en extracción limpia sin requerir el archivo ZIP externo.
   - CHECK 4 detecta la presencia de `node_modules` antes de compilar TS; si no está presente en extracción previa a `npm ci`, utiliza la prueba criptográfica nativa de Node.js sin fallar con errores de execSync.
   - Flujo de trabajo estándar certificado: `unzip` -> `npm ci` -> `node validate_v0.3.29.cjs` (7/7 PASS) -> `npm test` (PASS).
5. **Confirmación de Convergencia H-05 (`email_worker` NOCREATEROLE):** **PASS / CLOSED** — Confirmado por auditoría que `0000_bootstrap_roles.sql` incluye `NOCREATEROLE` en `ALTER ROLE email_worker` y la suite de integración realiza la degradación y reconvergencia real contra `pg_roles`.
6. **Prueba de Descifrado Legacy (`enc:`):** **PASS** — Descifrado transparente verificado.
7. **Auditoría de Seguridad de Dependencias (`npm audit --omit=dev`):** **PASS** — 0 vulnerabilidades.

---

## 2. Gobernanza de Despliegue

- **Rama Git:** `release/v0.3.29-candidate`
- **Merge a `main`:** **NO REALIZADO** (`main` intacto).
- **Etiqueta Git `v0.3.29`:** **NO CREADA**.
- **Servidor de Producción Plesk:** Inmune e intacto (Línea base certificada en **v0.3.17** `ed74688`).
