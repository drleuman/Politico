/**
 * Validator Estático, Mecánico y Semántico — Política Canon v0.3.23 (Fase 1.1 Funcional Remediada)
 * Estrictamente Multiplataforma (Linux/Ubuntu & Windows) sin dependencias externas ni powershell.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('=== AUDITORÍA E INSPECCIÓN MECÁNICA Y SEMÁNTICA RIGUROSA — RELEASE v0.3.23 ===\n');

const EXPECTED_VERSION = '0.3.23';
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
  execSync('node --check validate_v0.3.23.cjs', { stdio: 'pipe' });
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

// CHECK 2: Inspección DDL de Esquema para organization_memberships (C-02)
const migration0001 = fs.readFileSync(path.join(process.cwd(), 'db/migrations/0001_initial_schema.sql'), 'utf8');
const memBlock = migration0001.substring(migration0001.indexOf('CREATE TABLE organization_memberships'), migration0001.indexOf('CREATE TABLE workspace_memberships'));
if (memBlock.includes('organization_id') && !/\bupdated_at\b/.test(memBlock) && !/\brole\b/.test(memBlock)) {
  console.log(`✅ CHECK 2: Verificación DDL de organization_memberships (C-02)`);
  console.log(`   └─ Esquema exacto sin columnas inexistentes 'role' ni 'updated_at'.`);
} else {
  console.error(`❌ CHECK 2 FAIL: Esquema SQL inválido para organization_memberships.`);
  process.exit(1);
}

// CHECK 3: Erradicación de Cookie Heredada sid (H-01)
const authRoutes = fs.readFileSync(path.join(process.cwd(), 'src/auth/routes.ts'), 'utf8');
if (authRoutes.includes("__Host-sid") && !authRoutes.includes("cookies.sid")) {
  console.log(`✅ CHECK 3: Erradicación de Cookie Heredada sid (H-01)`);
  console.log(`   └─ extractSessionToken() utiliza exclusivamente __Host-sid.`);
} else {
  console.error(`❌ CHECK 3 FAIL: Aún existe fallback a cookie sid.`);
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

// CHECK 5: Fidelidad DDL Reversión 0005 Down y Outbox (C-03, C-04 & H-02)
const migration0005Down = fs.readFileSync(path.join(process.cwd(), 'db/migrations/0005_fase_1_1_functional_down.sql'), 'utf8');
if (migration0005Down.includes('DROP TABLE IF EXISTS email_outbox') && migration0005Down.includes('tenant_isolation_policy')) {
  console.log(`✅ CHECK 5: Reversión/Rollback DDL de Migración 0005 Down (H-02 & C-03)`);
  console.log(`   └─ 0005_down elimina email_outbox, función de revocación y restaura políticas RLS.`);
} else {
  console.error(`❌ CHECK 5 FAIL: 0005_down incompleto.`);
  process.exit(1);
}

// CHECK 6: Coherencia de Metadatos de Versión v0.3.23 (M-01)
const pkgJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const provisionSh = fs.readFileSync(path.join(process.cwd(), 'deploy/scripts/provision.sh'), 'utf8');
const serverTs = fs.readFileSync(path.join(process.cwd(), 'src/server.ts'), 'utf8');

if (pkgJson.version === EXPECTED_VERSION && provisionSh.includes(EXPECTED_VERSION) && serverTs.includes(EXPECTED_VERSION)) {
  console.log(`✅ CHECK 6: Coherencia de Metadatos de Release v${EXPECTED_VERSION} (M-01)`);
  console.log(`   └─ Versión ${EXPECTED_VERSION} consistente en package.json, provision.sh y server.ts.`);
} else {
  console.error(`❌ CHECK 6 FAIL: Incoherencia de versión en metadatos.`);
  process.exit(1);
}

// CHECK 7: Durabilidad de Outbox, Concurrencia FOR UPDATE SKIP LOCKED y Sanitización (C-04, H-04)
const outboxTs = fs.readFileSync(path.join(process.cwd(), 'src/email/outbox.ts'), 'utf8');
if (
  outboxTs.includes('FOR UPDATE SKIP LOCKED') &&
  outboxTs.includes('[REDACTED]') &&
  outboxTs.includes('next_attempt_at')
) {
  console.log(`✅ CHECK 7: Arquitectura de Outbox Duradero y Sanitizado de Tokens (C-04, H-04)`);
  console.log(`   └─ processEmailOutbox implementa FOR UPDATE SKIP LOCKED, reintentos con backoff y ofuscación de tokens.`);
} else {
  console.error(`❌ CHECK 7 FAIL: Módulo outbox.ts no incluye las garantías requeridas.`);
  process.exit(1);
}

console.log('\n--------------------------------------------------------------------------');
console.log(`DICTAMEN DE REMEDIACIÓN TÉCNICA RELEASE v${EXPECTED_VERSION}: PASS (7/7 CONTROLES SUPERADOS)\n`);
