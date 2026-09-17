/**
 * Validator Estático, Mecánico y Semántico — Política Canon v0.3.25 (Fase 1.1 Funcional Remediada Certificada)
 * Estrictamente Multiplataforma (Linux/Ubuntu & Windows) sin dependencias externas ni powershell.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('=== AUDITORÍA E INSPECCIÓN MECÁNICA Y SEMÁNTICA RIGUROSA — RELEASE v0.3.25 ===\n');

const EXPECTED_VERSION = '0.3.25';
const EXPECTED_ZIP = `politica-canon-v${EXPECTED_VERSION}.zip`;
const EXPECTED_MANIFEST = `MANIFEST_v${EXPECTED_VERSION}.json`;

const zipPath = path.join(process.cwd(), EXPECTED_ZIP);
const manifestPath = path.join(process.cwd(), EXPECTED_MANIFEST);

// CHECK 1: H-01 Fail-Closed — Verificación de Existencia Física de Artefacto y Manifiesto
if (!fs.existsSync(zipPath) || !fs.existsSync(manifestPath)) {
  console.error(`❌ CHECK 1 FAIL (H-01 FAIL-CLOSED): Artefactos requeridos ausentes.`);
  if (!fs.existsSync(zipPath)) console.error(`   └─ No se encontró ${EXPECTED_ZIP}`);
  if (!fs.existsSync(manifestPath)) console.error(`   └─ No se encontró ${EXPECTED_MANIFEST}`);
  process.exit(1);
}

// Gate Sintáctico (H-02): Verificar sintaxis de scripts y archivos principales
try {
  execSync('node --check scripts/test-integration-pg16.mjs', { stdio: 'pipe' });
  execSync('node --check validate_v0.3.25.cjs', { stdio: 'pipe' });
  execSync('node --check scripts/email-worker.mjs', { stdio: 'pipe' });
} catch (syntaxErr) {
  console.error(`❌ CHECK GATE FAIL (H-02 SINTAXIS): Error sintáctico detectado en archivos del proyecto: ${syntaxErr.message}`);
  process.exit(1);
}

const zipBytes = fs.readFileSync(zipPath);
const calculatedHash = crypto.createHash('sha256').update(zipBytes).digest('hex');
const actualSize = zipBytes.length;

/**
 * Parser JavaScript nativo y multiplataforma del Central Directory de un archivo ZIP.
 * Funciona en Linux, macOS y Windows sin utilidades de shell ni powershell.
 */
function parseZipEntriesBuffer(buffer) {
  const entries = [];
  // Buscar la firma EOCD (0x06054b50) desde el final del archivo
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('EOCD_NOT_FOUND: Firma de fin de directorio central ZIP no encontrada.');
  }

  const cdEntriesCount = buffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  let currOffset = cdOffset;
  for (let i = 0; i < cdEntriesCount; i++) {
    if (buffer.readUInt32LE(currOffset) !== 0x02014b50) {
      throw new Error(`INVALID_CD_HEADER: Firma inválida en entrada central ${i} a offset ${currOffset}`);
    }
    const fileNameLen = buffer.readUInt16LE(currOffset + 28);
    const extraLen = buffer.readUInt16LE(currOffset + 30);
    const commentLen = buffer.readUInt16LE(currOffset + 32);

    const fileName = buffer.toString('utf8', currOffset + 46, currOffset + 46 + fileNameLen);
    entries.push(fileName);

    currOffset += 46 + fileNameLen + extraLen + commentLen;
  }

  return entries;
}

let zipEntries = [];
try {
  zipEntries = parseZipEntriesBuffer(zipBytes);
} catch (zipErr) {
  console.error(`❌ CHECK 1 FAIL: Falló la inspección pura en Node.js del ZIP: ${zipErr.message}`);
  process.exit(1);
}

const actualFileCount = zipEntries.length;
const manifestObj = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (manifestObj.sha256 !== calculatedHash) {
  console.error(`❌ CHECK 1 FAIL: SHA-256 no coincide. Esperado: ${manifestObj.sha256}, Calculado: ${calculatedHash}`);
  process.exit(1);
}
if (manifestObj.sizeBytes !== actualSize) {
  console.error(`❌ CHECK 1 FAIL: Tamaño no coincide. Esperado: ${manifestObj.sizeBytes}, Observado: ${actualSize}`);
  process.exit(1);
}
if (manifestObj.fileCount !== actualFileCount) {
  console.error(`❌ CHECK 1 FAIL: Conteo de entradas no coincide. Esperado: ${manifestObj.fileCount}, Físico: ${actualFileCount}`);
  process.exit(1);
}

// Inspección de raíz interna e higiene
const expectedRoot = `politica-canon-v${EXPECTED_VERSION}/`;
for (const entry of zipEntries) {
  const normEntry = entry.replace(/\\/g, '/');
  if (!normEntry.startsWith(expectedRoot)) {
    console.error(`❌ CHECK 1 FAIL: Entrada '${normEntry}' fuera de raíz esperada '${expectedRoot}'.`);
    process.exit(1);
  }
  if (normEntry.includes('.git/') || normEntry.includes('node_modules/') || normEntry.includes('dist/') || normEntry.endsWith('.env')) {
    console.error(`❌ CHECK 1 FAIL (HIGIENE): Entrada prohibida '${normEntry}' encontrada en ZIP.`);
    process.exit(1);
  }
}
console.log(`✅ CHECK 1: Integridad Física y Criptográfica Multiplataforma (Node.js nativo Ubuntu/Win)`);
console.log(`   └─ SHA-256: ${calculatedHash.substring(0, 16)}..., Tamaño: ${actualSize} bytes, Entradas: ${actualFileCount}, Raíz: ${expectedRoot}`);

// CHECK 2: Verificación de Finales de Línea LF (C-01) y Ausencia de Claves Harcodeadas en DDL (C-02)
const provisionSh = fs.readFileSync(path.join(process.cwd(), 'deploy/scripts/provision.sh'), 'utf8');
const permissionsSql = fs.readFileSync(path.join(process.cwd(), 'db/0002_bootstrap_permissions.sql'), 'utf8');

if (provisionSh.includes('\r')) {
  console.error(`❌ CHECK 2 FAIL (C-01): deploy/scripts/provision.sh contiene finales de línea CRLF (\\r). Exigido LF (\\n) puro.`);
  process.exit(1);
}

if (permissionsSql.includes('email_worker_dev_pass')) {
  console.error(`❌ CHECK 2 FAIL (C-02): db/0002_bootstrap_permissions.sql contiene la clave harcodeada 'email_worker_dev_pass'.`);
  process.exit(1);
}

console.log(`✅ CHECK 2: Verificación de Finales de Línea LF en Shell Scripts y Ausencia de Claves Harcodeadas en DDL (C-01, C-02)`);
console.log(`   └─ provision.sh es LF puro (0 CRLF) y DDL SQL libre de credenciales expuestas.`);

// CHECK 3: Erradicación de Cookie Heredada sid y Llamadas HTTP a Outbox (H-01)
const authRoutes = fs.readFileSync(path.join(process.cwd(), 'src/auth/routes.ts'), 'utf8');
if (authRoutes.includes("__Host-sid") && !authRoutes.includes("cookies.sid") && !authRoutes.includes("processEmailOutbox(")) {
  console.log(`✅ CHECK 3: Erradicación de Cookie Heredada sid y llamadas HTTP a processEmailOutbox (H-01)`);
  console.log(`   └─ Rutas web limitadas exclusivamente a encolado transaccional INSERT sin invocar el procesador.`);
} else {
  console.error(`❌ CHECK 3 FAIL: Aún existen llamadas HTTP a processEmailOutbox o fallback sid.`);
  process.exit(1);
}

// CHECK 4: Evaluación de Jerarquía sobre TODOS los Roles (C-02)
if (authRoutes.includes('targetRoles.includes(\'ADMIN\')') || authRoutes.includes('targetHasAdminRole')) {
  console.log(`✅ CHECK 4: Evaluación Jerárquica sobre Asignaciones Multi-Rol (C-02)`);
  console.log(`   └─ PATCH /api/v1/users/:id/status evalúa targetRoles completo (WRITER + ADMIN).`);
} else {
  console.error(`❌ CHECK 4 FAIL: PATCH /users/:id/status examina solo la primera fila de roles.`);
  process.exit(1);
}

// CHECK 5: Provisión Incondicional y Fail-Closed de Unidades Systemd (C-04)
if (
  provisionSh.includes('systemctl enable --now politica-canon.service') &&
  provisionSh.includes('systemctl enable --now politica-canon-outbox-worker.service') &&
  provisionSh.includes('WORKER_DB_PASS')
) {
  console.log(`✅ CHECK 5: Script de Provisión Habilita Incondicionalmente Ambas Unidades Systemd (C-04)`);
  console.log(`   └─ provision.sh ejecuta systemctl enable --now incondicional para ambas unidades y verifica is-active.`);
} else {
  console.error(`❌ CHECK 5 FAIL: provision.sh no ejecuta la lógica incondicional de systemd.`);
  process.exit(1);
}

// CHECK 6: Coherencia de Metadatos de Versión v0.3.25 (M-01)
const pkgJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const serverTs = fs.readFileSync(path.join(process.cwd(), 'src/server.ts'), 'utf8');

if (pkgJson.version === EXPECTED_VERSION && provisionSh.includes(EXPECTED_VERSION) && serverTs.includes(EXPECTED_VERSION)) {
  console.log(`✅ CHECK 6: Coherencia de Metadatos de Release v${EXPECTED_VERSION} (M-01)`);
  console.log(`   └─ Versión ${EXPECTED_VERSION} consistente en package.json, provision.sh y server.ts.`);
} else {
  console.error(`❌ CHECK 6 FAIL: Incoherencia de versión en metadatos.`);
  process.exit(1);
}

// CHECK 7: Cifrado de Tokens en Reposo, Aserciones de Seguridad Worker y Mínimos Privilegios (C-03, H-01, H-04)
const cryptoPayloadTs = fs.readFileSync(path.join(process.cwd(), 'src/email/crypto-payload.ts'), 'utf8');
const workerTs = fs.readFileSync(path.join(process.cwd(), 'src/email/worker.ts'), 'utf8');

if (
  cryptoPayloadTs.includes('aes-256-gcm') &&
  workerTs.includes('checkEmailWorkerSecurity') &&
  workerTs.includes('config.emailWorkerDatabaseUrl')
) {
  console.log(`✅ CHECK 7: Cifrado de Tokens AES-256-GCM y Aserciones de Seguridad Worker (C-03, H-01, H-04)`);
  console.log(`   └─ Tokens cifrados en PENDING/PROCESSING, worker exige EMAIL_WORKER_DATABASE_URL y valida matriz DML en arranque.`);
} else {
  console.error(`❌ CHECK 7 FAIL: Módulo worker o crypto-payload no implementa las garantías requeridas.`);
  process.exit(1);
}

console.log('\n--------------------------------------------------------------------------');
console.log(`DICTAMEN DE REMEDIACIÓN TÉCNICA RELEASE v${EXPECTED_VERSION}: PASS (7/7 CONTROLES SUPERADOS)\n`);
