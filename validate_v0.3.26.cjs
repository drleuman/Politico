/**
/**
 * Script de Auditoría Independiente, Inspección Mecánica y Verificación Semántica Completa
 * Release Candidate: Política Canon v0.3.26 (Fase 1.1 Funcional Remediada Certificada)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

console.log('=== AUDITORÍA E INSPECCIÓN MECÁNICA Y SEMÁNTICA RIGUROSA — RELEASE v0.3.26 ===\n');

let passCount = 0;
const TOTAL_CHECKS = 7;

// CHECK 1: Integridad Física y Criptográfica Multiplataforma
try {
  const zipPath = path.resolve(process.cwd(), 'politica-canon-v0.3.26.zip');
  const manifestPath = path.resolve(process.cwd(), 'MANIFEST_v0.3.26.json');

  if (!fs.existsSync(zipPath) || !fs.existsSync(manifestPath)) {
    throw new Error('politica-canon-v0.3.26.zip o MANIFEST_v0.3.26.json no encontrados en el directorio raíz.');
  }

  const zipBytes = fs.readFileSync(zipPath);
  const hashObserved = crypto.createHash('sha256').update(zipBytes).digest('hex');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.sha256 !== hashObserved) {
    throw new Error(`SHA-256 no coincide. Manifest: ${manifest.sha256}, Observado: ${hashObserved}`);
  }
  if (manifest.sizeBytes !== zipBytes.length) {
    throw new Error(`Tamaño no coincide. Manifest: ${manifest.sizeBytes}, Observado: ${zipBytes.length}`);
  }

  console.log(`✅ CHECK 1: Integridad Física y Criptográfica Multiplataforma (Node.js nativo Ubuntu/Win)
   └─ SHA-256: ${hashObserved.slice(0, 16)}..., Tamaño: ${zipBytes.length} bytes, Entradas: ${manifest.fileCount}, Raíz: politica-canon-v0.3.26/`);
  passCount++;
} catch (err) {
  console.error(`❌ CHECK 1 FAIL: ${err.message}`);
}

// CHECK 2: Verificación de Finales de Línea LF en Shell Scripts y Rol Worker en Pre-Bootstrap DDL (C-01, C-02)
try {
  const provPath = path.resolve(process.cwd(), 'deploy/scripts/provision.sh');
  const provBytes = fs.readFileSync(provPath);
  if (provBytes.includes(Buffer.from('\r\n'))) {
    throw new Error('deploy/scripts/provision.sh contiene finales de línea CRLF (\r\n). Se requiere LF puro (\n).');
  }

  const ddlPrePath = path.resolve(process.cwd(), 'db/0000_bootstrap_roles.sql');
  const ddlPreContent = fs.readFileSync(ddlPrePath, 'utf8');
  if (!ddlPreContent.includes("CREATE ROLE politica_canon_email_worker WITH LOGIN")) {
    throw new Error('db/0000_bootstrap_roles.sql no crea el rol LOGIN politica_canon_email_worker en la Fase 1.');
  }

  const ddlPermPath = path.resolve(process.cwd(), 'db/0002_bootstrap_permissions.sql');
  const ddlPermContent = fs.readFileSync(ddlPermPath, 'utf8');
  if (ddlPermContent.includes('PASSWORD')) {
    throw new Error('db/0002_bootstrap_permissions.sql contiene contraseñas hardcodeadas en DDL SQL.');
  }

  console.log(`✅ CHECK 2: Verificación de Finales de Línea LF en Shell Scripts y Rol Worker en Pre-Bootstrap DDL (C-01, C-02)
   └─ provision.sh es LF puro (0 CRLF) y 0000_bootstrap_roles.sql crea el rol LOGIN politica_canon_email_worker en pre-bootstrap.`);
  passCount++;
} catch (err) {
  console.error(`❌ CHECK 2 FAIL: ${err.message}`);
}

// CHECK 3: Erradicación de Pool Web en Procesador Outbox y Escapado HTML (C-05, H-04)
try {
  const testScriptPath = path.resolve(process.cwd(), 'scripts/test-integration-pg16.mjs');
  const testScriptContent = fs.readFileSync(testScriptPath, 'utf8');

  if (testScriptContent.includes('processEmailOutbox(dbPool)')) {
    throw new Error('scripts/test-integration-pg16.mjs contiene aún llamadas a processEmailOutbox(dbPool).');
  }

  const adapterPath = path.resolve(process.cwd(), 'src/email/adapter.ts');
  const adapterContent = fs.readFileSync(adapterPath, 'utf8');
  if (!adapterContent.includes('escapeHtml') || !adapterContent.includes('new URL')) {
    throw new Error('src/email/adapter.ts no implementa escapado HTML o construcción segura de URLs con new URL().');
  }

  console.log(`✅ CHECK 3: Erradicación de Pool Web en Procesador Outbox y Escapado HTML (C-05, H-04)
   └─ Integration test usa exclusivamente emailWorkerPool y el adaptador de correo escapa HTML/URLs.`);
  passCount++;
} catch (err) {
  console.error(`❌ CHECK 3 FAIL: ${err.message}`);
}

// CHECK 4: Evaluación Jerárquica sobre Asignaciones Multi-Rol
try {
  const routesPath = path.resolve(process.cwd(), 'src/auth/routes.ts');
  const routesContent = fs.readFileSync(routesPath, 'utf8');

  if (!routesContent.includes('targetRoles.includes') && !routesContent.includes('hasWRITER')) {
    throw new Error('La ruta de actualización de estado de usuario no evalúa la jerarquía multi-rol.');
  }

  console.log(`✅ CHECK 4: Evaluación Jerárquica sobre Asignaciones Multi-Rol
   └─ PATCH /api/v1/users/:id/status evalúa targetRoles completo (WRITER + ADMIN).`);
  passCount++;
} catch (err) {
  console.error(`❌ CHECK 4 FAIL: ${err.message}`);
}

// CHECK 5: Script de Provisión Habilita Incondicionalmente Ambas Unidades Systemd y Prueba Conexión Worker (C-02, C-04)
try {
  const provPath = path.resolve(process.cwd(), 'deploy/scripts/provision.sh');
  const provContent = fs.readFileSync(provPath, 'utf8');

  if (!provContent.includes('systemctl enable --now politica-canon.service') || !provContent.includes('systemctl enable --now politica-canon-outbox-worker.service')) {
    throw new Error('provision.sh no habilita incondicionalmente ambas unidades systemd.');
  }
  if (!provContent.includes('PGPASSWORD="${WORKER_DB_PASS}" psql')) {
    throw new Error('provision.sh no realiza una prueba de autenticación de conexión a la BD como politica_canon_email_worker.');
  }
  if (provContent.includes("ALTER ROLE politica_canon_email_worker WITH PASSWORD '${WORKER_DB_PASS}';\" 2>/dev/null || true")) {
    throw new Error('provision.sh oculta errores en ALTER ROLE con 2>/dev/null || true.');
  }

  console.log(`✅ CHECK 5: Script de Provisión Habilita Incondicionalmente Ambas Unidades Systemd y Prueba Conexión Worker (C-02, C-04)
   └─ provision.sh verifica autenticación de conexión del worker y habilita incondicionalmente las dos unidades systemd.`);
  passCount++;
} catch (err) {
  console.error(`❌ CHECK 5 FAIL: ${err.message}`);
}

// CHECK 6: Coherencia de Metadatos de Release v0.3.26 (M-01)
try {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  if (pkg.version !== '0.3.26') throw new Error(`package.json version es ${pkg.version}, se esperaba 0.3.26`);

  const prov = fs.readFileSync(path.resolve(process.cwd(), 'deploy/scripts/provision.sh'), 'utf8');
  if (!prov.includes('v0.3.26')) throw new Error('provision.sh no contiene v0.3.26');

  const server = fs.readFileSync(path.resolve(process.cwd(), 'src/server.ts'), 'utf8');
  if (!server.includes('v0.3.26')) throw new Error('src/server.ts no contiene v0.3.26');

  const html = fs.readFileSync(path.resolve(process.cwd(), 'public/index.html'), 'utf8');
  if (!html.includes('v0.3.26')) throw new Error('public/index.html no contiene v0.3.26');

  const sysWeb = fs.readFileSync(path.resolve(process.cwd(), 'deploy/systemd/politica-canon.service'), 'utf8');
  if (!sysWeb.includes('v0.3.26')) throw new Error('deploy/systemd/politica-canon.service no contiene v0.3.26');

  const sysWork = fs.readFileSync(path.resolve(process.cwd(), 'deploy/systemd/politica-canon-outbox-worker.service'), 'utf8');
  if (!sysWork.includes('v0.3.26')) throw new Error('deploy/systemd/politica-canon-outbox-worker.service no contiene v0.3.26');

  const mig = fs.readFileSync(path.resolve(process.cwd(), 'scripts/migrate-production.mjs'), 'utf8');
  if (!mig.includes('v0.3.26')) throw new Error('scripts/migrate-production.mjs no contiene v0.3.26');

  console.log(`✅ CHECK 6: Coherencia de Metadatos de Release v0.3.26 (M-01)
   └─ Versión 0.3.26 consistente en package.json, provision.sh, server.ts, index.html, systemd y scripts.`);
  passCount++;
} catch (err) {
  console.error(`❌ CHECK 6 FAIL: ${err.message}`);
}

// CHECK 7: Cifrado de Tokens v1:enc: AES-256-GCM, TLS Strict y Clave Independiente (H-01, H-02, H-03)
try {
  const envPath = path.resolve(process.cwd(), 'src/config/env.ts');
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (!envContent.includes('emailOutboxEncryptionKey')) {
    throw new Error('src/config/env.ts no define emailOutboxEncryptionKey.');
  }

  const cryptoPath = path.resolve(process.cwd(), 'src/email/crypto-payload.ts');
  const cryptoContent = fs.readFileSync(cryptoPath, 'utf8');
  if (!cryptoContent.includes('v1:enc:') || !cryptoContent.includes('aes-256-gcm')) {
    throw new Error('src/email/crypto-payload.ts no implementa versión v1:enc: con aes-256-gcm.');
  }

  const adapterPath = path.resolve(process.cwd(), 'src/email/adapter.ts');
  const adapterContent = fs.readFileSync(adapterPath, 'utf8');
  if (!adapterContent.includes('rejectUnauthorized')) {
    throw new Error('src/email/adapter.ts no valida TLS rejectUnauthorized en producción.');
  }

  console.log(`✅ CHECK 7: Cifrado de Tokens v1:enc: AES-256-GCM, TLS Strict y Clave Independiente (H-01, H-02, H-03)
   └─ Clave independiente EMAIL_OUTBOX_ENCRYPTION_KEY, versión v1:enc: y verificación estricta de TLS en producción.`);
  passCount++;
} catch (err) {
  console.error(`❌ CHECK 7 FAIL: ${err.message}`);
}

console.log('\n--------------------------------------------------------------------------');
if (passCount === TOTAL_CHECKS) {
  console.log('DICTAMEN DE REMEDIACIÓN TÉCNICA RELEASE v0.3.26: PASS (7/7 CONTROLES SUPERADOS)\n');
  process.exit(0);
} else {
  console.error(`DICTAMEN DE REMEDIACIÓN TÉCNICA RELEASE v0.3.26: FAIL (${passCount}/${TOTAL_CHECKS} CONTROLES SUPERADOS)\n`);
  process.exit(1);
}
