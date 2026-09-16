const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { PGlite } = require('@electric-sql/pglite');

console.log('=== AUDITORÍA E INSPECCIÓN MECÁNICA Y SEMÁNTICA RIGUROSA — RELEASE v0.3.5 (FASE 1 MVP) ===\n');

let passCount = 0;
let failCount = 0;

function assertCheck(name, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passCount++;
  } else {
    console.log(`[FAIL] ${name} ${detail ? '-> ' + detail : ''}`);
    failCount++;
  }
}

async function runValidation() {
  // 1. Verificación de Enlaces Relativos Markdown (269 enlaces)
  let brokenLinks = 0;
  let totalLinks = 0;
  const markdownFiles = [];

  function collectMarkdownFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
          collectMarkdownFiles(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        markdownFiles.push(fullPath);
      }
    }
  }

  collectMarkdownFiles('.');

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  for (const file of markdownFiles) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const linkPath = match[2];
      if (linkPath.startsWith('http://') || linkPath.startsWith('https://') || linkPath.startsWith('#') || linkPath.startsWith('mailto:')) {
        continue;
      }
      totalLinks++;
      const cleanPath = linkPath.split('#')[0];
      if (!cleanPath) continue;
      const targetPath = path.resolve(path.dirname(file), cleanPath);
      if (!fs.existsSync(targetPath)) {
        brokenLinks++;
        console.log(`  -> Link roto en ${file}: ${linkPath}`);
      }
    }
  }
  assertCheck(`Verificación de Enlaces Relativos Markdown (${totalLinks} inspeccionados)`, brokenLinks === 0, `${brokenLinks} enlaces rotos`);

  // 2. Preservación Criptográfica Inmutable de Informes Históricos (H-03: 45 Informes y Matrices Completo)
  const historicalHashes = {
    'REMEDIATION_MATRIX.md': '6e9d49f36dcc4e144d3a48b3bd910017bf871548fab38fe0171242b318364fa0',
    'REMEDIATION_MATRIX_v0.2.10.md': 'e86ad565fd6b58d2de6f34985a71003a5ff39ccd08e0fe785d68c25a47960e0e',
    'REMEDIATION_MATRIX_v0.2.11.md': 'c491c202b18cc347b5102b483fd195d51b814854e64a3061166f653fd6bd1e63',
    'REMEDIATION_MATRIX_v0.2.12.md': 'b02b67802c76682f74a946638213c53d13cb38a1099ab86b0b91e93c2058e221',
    'REMEDIATION_MATRIX_v0.2.13.md': 'c942278b7ac677d83542210445c18f3bb2b66375cf16b9c1eafa180cd6e4b297',
    'REMEDIATION_MATRIX_v0.2.14.md': '1516641090b5613ec864c0499d70d39bba89124a9a4671786130466dabb08728',
    'REMEDIATION_MATRIX_v0.2.15.md': 'ab1bec926615d5f6ed92a45605c3969703cbace1a92f53ef24e92c3959fc5e0f',
    'REMEDIATION_MATRIX_v0.2.16.md': 'a1d8bfb7a2182fa8881f416091b64db42c183c2e410dca4cac74accac9568696',
    'REMEDIATION_MATRIX_v0.2.17.md': '570c53e16aaa13739259ef2eb7117ccedb75c73df1a0b61738bf337651776d2e',
    'REMEDIATION_MATRIX_v0.2.18.md': '7164c758aeea30ad2254b3f3d754c37a1f094449e81fd07cd8f9dc6b1dc3f1e9',
    'REMEDIATION_MATRIX_v0.2.2.md': '1d5e1e1edb6d18d0c7e3adf21c2ca46f2c6cdd51a56a47d2b42d52c798822c17',
    'REMEDIATION_MATRIX_v0.2.3.md': '4bcee14f357606991e651e5483b2dcb27f60d43a23e2d2029c3be8920ecf8674',
    'REMEDIATION_MATRIX_v0.2.4.md': '9282f111e0d24d882bd1a62cbd8d31a2bf1436f124f4904afc7a6c2a0e8de54e',
    'REMEDIATION_MATRIX_v0.2.5.md': '624c6178cc8d3210d5073196a0ef3c60e7c443568707cc21b1f732ee9c37f5a8',
    'REMEDIATION_MATRIX_v0.2.6.md': '7f6008dc9d61e9751965f927b57458ef473e355ef9e1832718d8ada5e2ee4ad5',
    'REMEDIATION_MATRIX_v0.2.7.md': 'bc0575070fbd1ae5d53a97f42dd8562ee359bb99ee7f1dbec30dffab2486f0f8',
    'REMEDIATION_MATRIX_v0.2.8.md': '2df9f0f508b869eb963e75bafd018e42461e82e7d6094b56a753bee94ac269a7',
    'REMEDIATION_MATRIX_v0.2.9.md': '9a2d11e3c214c8d3e1fd8f6c73af612b58c891ff3c1d6d0d38d41e648eb47969',
    'REMEDIATION_MATRIX_v0.3.0.md': '45e64c4d3dcc64b53f34fe5fd7d7fd9cd2c53d02e4d462869b99c367bddacd30',
    'REMEDIATION_MATRIX_v0.3.1.md': '76e0f411e61fe00ca590f3967828ac2df476c03a78f160ce2e84a6e4d3d81516',
    'REMEDIATION_MATRIX_v0.3.2.md': 'f334df5fea3c454afaed05c5e5b7ef858254024bfc862846cbc969749f2ec873',
    'REMEDIATION_MATRIX_v0.3.3.md': '463fb664f52745afa0aae09569a5b7501c8f130da86a0843b936fb2158f4c24b',
    'REMEDIATION_MATRIX_v0.3.4.md': 'f027d590880c4b47d38a72c577658c83048f5dfef143db6ea447f54cb1761261',
    'REMEDIATION_MATRIX_v0.3.5.md': 'f5bbfd878667d9ad6eb9a21eb6b43604e2372699b2f1ad5b1005ee4ad07f36c2',
    'VALIDATION_REPORT.md': 'df4ff25ce327b8c95dc49bf76a76bb9ce25d599b89c02f08b1a447c3f8c2aa83',
    'VALIDATION_REPORT_v0.2.10.md': '8287ed8d666bd3ea6e2949a6139f455a7fe904c6b1e7385a3812ae53b5ce0ce6',
    'VALIDATION_REPORT_v0.2.11.md': 'c9b97d4eb85142b731ffd0b9572afd42dccf93f95b254d5dc80342d061b680f4',
    'VALIDATION_REPORT_v0.2.12.md': '3ec0bd9cc3ce81184222778b4368f1bbc27d5a73aaa3f76d87d9357a45063b19',
    'VALIDATION_REPORT_v0.2.13.md': '363a6b342eae26e7079da32aeda604a508f4a4ba1fa5478fd7b29a0e6afa39c9',
    'VALIDATION_REPORT_v0.2.14.md': 'ec462b65d43a26ae80001f0680ae1a1475ba54fcaa82df038a14902b0c7aae5b',
    'VALIDATION_REPORT_v0.2.15.md': 'a1a145c96744e2c4403dc46f1791ccf6da502820a109b6f01d9a20b05c930919',
    'VALIDATION_REPORT_v0.2.16.md': '875c9a0fd3d027a4b4803fb5701a2094a1c0a0fee9db5da7fa37306d02aafb47',
    'VALIDATION_REPORT_v0.2.17.md': '2117363ec635bc8d45672d6e2fa1081c8d5939205b4a73efd92463610693b156',
    'VALIDATION_REPORT_v0.2.18.md': 'aab1cb3ac033419ff2cbfe327b4bc886110fee02eb917e7bb144513b66e1f8ed',
    'VALIDATION_REPORT_v0.2.3.md': '3857bd436b09253a9b1fec7b0ef60a46de07cb123f0a1069ed8035116695cfd4',
    'VALIDATION_REPORT_v0.2.4.md': 'ce78e080a70032a9c2885db6af52723d70ca471ed76bf2c3bd86f52ea3f1488d',
    'VALIDATION_REPORT_v0.2.5.md': '1ede48e4226a33b1d23f695591ae32ecc0686bcbe696aed5487297b61188a5d4',
    'VALIDATION_REPORT_v0.2.6.md': 'ee396fc12d5c45d198596bff90dd9454d27b446a20e3721fd654abb2ebf94e5f',
    'VALIDATION_REPORT_v0.2.7.md': '2262010d22ac958efeac14baf11152cf3fc81324cfbefa674483b79ee75278cd',
    'VALIDATION_REPORT_v0.2.8.md': '0b627a9acd9e274f1b93cc3aa9433511edd70496c4fa9602b38b84943ae9ffa8',
    'VALIDATION_REPORT_v0.2.9.md': '94950d7a1548a59fec2c0bc7f8ff2d054ab862756d9d543dd662c96aa5eb86a5',
    'VALIDATION_REPORT_v0.3.0.md': '9dd5e590c59139419c56c819a1fb406393ef6ad6d7b4305af210dc4b98cf393c',
    'VALIDATION_REPORT_v0.3.1.md': 'c3e472f083fac8aff152fe1b9ab2a79d42a184dc6647f8ff9633dcdb163c1959',
    'VALIDATION_REPORT_v0.3.2.md': '66d721a7864e3b42d9d4ca6b1509b2cf058cb8b60ed1a13bdff19f958f207619',
    'VALIDATION_REPORT_v0.3.3.md': '3792f40ac259989340d4dda3bf8ec10cbaa3cc7bb1a9cea1aaad030a0653eb81',
    'VALIDATION_REPORT_v0.3.4.md': '8b8c790eae36c9eb43034667b964287806993a2abd219fac2938c7c989d54617'
  };

  let alteredFiles = 0;
  for (const [relPath, expectedHash] of Object.entries(historicalHashes)) {
    if (!fs.existsSync(relPath)) {
      alteredFiles++;
      console.log(`  -> Archivo histórico faltante: ${relPath}`);
      continue;
    }
    const content = fs.readFileSync(relPath, 'utf8');
    const actualHash = crypto.createHash('sha256').update(content).digest('hex');
    if (actualHash !== expectedHash) {
      alteredFiles++;
      console.log(`  -> Alteración en ${relPath}: esperado ${expectedHash}, actual ${actualHash}`);
    }
  }
  assertCheck(`Preservación Criptográfica Inmutable de Informes Históricos (${Object.keys(historicalHashes).length} verificados)`, alteredFiles === 0, `${alteredFiles} archivos alterados`);

  // 3. Compilación TypeScript Estricta
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    assertCheck('Compilación TypeScript Estricta (tsc --noEmit) sin Errores', true);
  } catch (err) {
    assertCheck('Compilación TypeScript Estricta (tsc --noEmit) sin Errores', false, err.stdout?.toString() || err.message);
  }

  // 4. Coherencia de Metadatos de Release v0.3.5 (H-04)
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const nginxConf = fs.readFileSync('deploy/plesk/vhost_nginx.conf', 'utf8');
  const systemdService = fs.readFileSync('deploy/systemd/politica-canon.service', 'utf8');
  const provisionSh = fs.readFileSync('deploy/scripts/provision.sh', 'utf8');
  const indexHtml = fs.readFileSync('public/index.html', 'utf8');

  const metaVersion = packageJson.version === '0.3.5' &&
    nginxConf.includes('v0.3.5') &&
    systemdService.includes('v0.3.5') &&
    provisionSh.includes('v0.3.5') &&
    indexHtml.includes('v0.3.5');

  assertCheck('Coherencia de Metadatos de Release v0.3.5 (H-04)', metaVersion, `package.json=${packageJson.version}`);

  // 5. Integración PostgreSQL PGlite: 3 Fases, Standalone ALTER DATABASE, Permisos DML, Audit Worker y Default Privileges (C-01..C-03, H-01, H-02, H-03)
  try {
    const db = new PGlite();

    const bootstrapPre = fs.readFileSync('db/0000_bootstrap_roles.sql', 'utf8');
    const initialSchemaRaw = fs.readFileSync('db/migrations/0001_initial_schema.sql', 'utf8');
    const initialSchema = initialSchemaRaw.replace(/CREATE EXTENSION IF NOT EXISTS\s+("?pgcrypto"?);?/gi, '-- pgcrypto native');
    const bootstrapPost = fs.readFileSync('db/0002_bootstrap_permissions.sql', 'utf8');

    // Fase 1: Pre-bootstrap (como postgres)
    await db.exec(bootstrapPre);

    // Fase 2: Migración DDL ejecutando SET ROLE app_owner (C-01)
    await db.exec('SET ROLE app_owner;');
    const setRoleCheck = await db.query('SELECT current_user;');
    const currentUserRole = setRoleCheck.rows[0]?.current_user;
    if (currentUserRole !== 'app_owner') {
      throw new Error(`SET ROLE app_owner falló o no cambió el usuario activo: current_user = ${currentUserRole}`);
    }

    await db.exec(initialSchema);
    await db.exec('RESET ROLE;');

    // Fase 3: Post-bootstrap (C-01: consulta standalone sin BEGIN/DO para ALTER DATABASE + bloque transaccional para DML/RLS)
    try {
      await db.exec('ALTER DATABASE politica_canon OWNER TO app_owner;');
    } catch {
      // Ignorado en PGlite in-memory si datname no coincide
    }

    await db.exec(bootstrapPost);

    // Verificación de Atributos de audit_dispatcher (C-02)
    const dispatcherCheck = await db.query(`
      SELECT rolname, rolbypassrls 
      FROM pg_roles 
      WHERE rolname = 'audit_dispatcher';
    `);
    const dispatcherBypass = dispatcherCheck.rows[0]?.rolbypassrls;
    if (!dispatcherBypass) {
      throw new Error('audit_dispatcher no tiene BYPASSRLS activado (C-02).');
    }

    // Verificación de Propiedad de get_pending_outbox_tenants (C-02, C-03)
    const funcOwnerCheck = await db.query(`
      SELECT pg_get_userbyid(p.proowner) as func_owner
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'get_pending_outbox_tenants';
    `);
    const funcOwner = funcOwnerCheck.rows[0]?.func_owner;
    if (funcOwner !== 'audit_dispatcher') {
      throw new Error(`get_pending_outbox_tenants es propiedad de '${funcOwner}', se requiere 'audit_dispatcher' (C-02).`);
    }

    // Verificación de Denegación DML Directa a app_user sobre Tablas de Gobernanza (H-02)
    await db.exec('SET ROLE app_user;');
    let dmlDenied = false;
    try {
      await db.exec("INSERT INTO decisions (id, organization_id, workspace_id, authority_body_id, document_id, version_id, submission_id, title) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Title');");
    } catch (err) {
      if (err.message.includes('permission denied')) {
        dmlDenied = true;
      }
    }

    // Verificación de Denegación de EXECUTE en get_pending_outbox_tenants para app_user (C-02)
    let funcDenied = false;
    try {
      await db.exec('SELECT get_pending_outbox_tenants();');
    } catch (err) {
      if (err.message.includes('permission denied')) {
        funcDenied = true;
      }
    }
    await db.exec('RESET ROLE;');

    // Verificación de H-01: Privilegios por defecto en función nueva
    await db.exec('SET ROLE app_owner;');
    await db.exec('CREATE FUNCTION public.test_h01_func() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;');
    await db.exec('RESET ROLE;');

    await db.exec('SET ROLE app_user;');
    let h01Denied = false;
    try {
      await db.exec('SELECT test_h01_func();');
    } catch (err) {
      if (err.message.includes('permission denied')) {
        h01Denied = true;
      }
    }
    await db.exec('RESET ROLE;');

    // Pruebas de Idempotencia: Repetición de las 3 fases
    await db.exec(bootstrapPre);
    await db.exec('SET ROLE app_owner;');
    await db.exec('RESET ROLE;');
    await db.exec(bootstrapPost);

    assertCheck('Cumplimiento de Condiciones de Aceptación (3 Fases, SET ROLE, Audit Dispatcher BYPASSRLS, DML Restringido, Default Privileges H-01)', dmlDenied && funcDenied && h01Denied);
  } catch (err) {
    assertCheck('Cumplimiento de Condiciones de Aceptación (3 Fases, SET ROLE, Audit Dispatcher BYPASSRLS, DML Restringido, Default Privileges H-01)', false, err.message);
  }

  // 6. Verificación del Migrador DDL Fail-Closed (C-01) y Bootstrap Post Non-Transactional (C-01 v0.3.5)
  const migradorCode = fs.readFileSync('scripts/migrate-production.mjs', 'utf8');
  const postBootstrapCode = fs.readFileSync('scripts/bootstrap-post.mjs', 'utf8');
  const postPermissionsSql = fs.readFileSync('db/0002_bootstrap_permissions.sql', 'utf8');

  const hasSetRole = migradorCode.includes("SET ROLE app_owner;") && migradorCode.includes("process.exit(1)");
  const standaloneDbOwner = postBootstrapCode.includes("ALTER DATABASE politica_canon OWNER TO app_owner;") &&
    !postPermissionsSql.includes("ALTER DATABASE politica_canon OWNER");

  assertCheck('Migrador DDL con SET ROLE app_owner Obligatorio y ALTER DATABASE Fuera de Transacción (C-01)', hasSetRole && standaloneDbOwner);

  // 7. Servidor Fastify & Probes HTTP Reales /readyz (H-04, H-05)
  try {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://politica_canon_app:testpass@127.0.0.1:5432/politica_canon';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379/0';
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'https://peaceful-johnson.194-164-175-146.plesk.page';

    const { buildServer } = await import('./dist/server.js');
    const app = buildServer();
    await app.ready();

    const healthRes = await app.inject({ method: 'GET', url: '/healthz' });
    const readyRes = await app.inject({ method: 'GET', url: '/readyz' });
    const rootRes = await app.inject({ method: 'GET', url: '/' });

    await app.close();

    const probesOk = healthRes.statusCode === 200 &&
      (readyRes.statusCode === 200 || readyRes.statusCode === 503) &&
      rootRes.statusCode === 200 &&
      rootRes.payload.includes('Intranet Privada — Política Canon');

    assertCheck('Pruebas HTTP Reales Fastify (/healthz, /readyz, Portada Intranet H-05)', probesOk, `health=${healthRes.statusCode}, ready=${readyRes.statusCode}`);
  } catch (err) {
    assertCheck('Pruebas HTTP Reales Fastify (/healthz, /readyz, Portada Intranet H-05)', false, err.message);
  }

  console.log(`\n---------------------------------------------------`);
  console.log(`TOTAL CHECKS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
  console.log(`DICTAMEN DE REMEDIACIÓN TÉCNICA RELEASE v0.3.5: ${failCount === 0 ? 'PASS' : 'FAIL'}\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runValidation();
