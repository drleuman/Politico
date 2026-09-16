import { execSync } from 'child_process';
import pg from 'pg';
const { Client } = pg;

console.log('=== RUNNER DE INTEGRACIÓN REAL POSTGRESQL 16 & REDIS (v0.3.10 STRICT FAIL-CLOSED) ===\n');

const ADMIN_URL = process.env.POLITICA_CANON_ADMIN_DATABASE_URL || 'postgresql://postgres:audit_dev_only_secret_do_not_use_in_prod@127.0.0.1:15432/politica_canon';
const MIGRATION_URL = process.env.MIGRATION_DATABASE_URL || ADMIN_URL;
const APP_TEST_PASSWORD = process.env.POLITICA_CANON_APP_TEST_PASSWORD || 'audit_dev_only_secret_do_not_use_in_prod';
const APP_URL = process.env.DATABASE_URL || `postgresql://politica_canon_app:${APP_TEST_PASSWORD}@127.0.0.1:15432/politica_canon`;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:16379/0';
const SESSION_SECRET = process.env.SESSION_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://peaceful-johnson.194-164-175-146.plesk.page';

process.env.POLITICA_CANON_ADMIN_DATABASE_URL = ADMIN_URL;
process.env.MIGRATION_DATABASE_URL = MIGRATION_URL;
process.env.DATABASE_URL = APP_URL;
process.env.REDIS_URL = REDIS_URL;
process.env.SESSION_SECRET = SESSION_SECRET;
process.env.APP_BASE_URL = APP_BASE_URL;

async function checkDockerAvailable() {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function waitForDb(adminUrl, retries = 20) {
  for (let i = 0; i < retries; i++) {
    const client = new Client({ connectionString: adminUrl });
    try {
      await client.connect();
      await client.query('SELECT 1;');
      await client.end();
      return true;
    } catch {
      await client.end().catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

function runScript(scriptPath, envVars = {}) {
  console.log(`▶ Ejecutando script de producción: ${scriptPath}`);
  const env = { ...process.env, ...envVars };
  execSync(`node ${scriptPath}`, { stdio: 'inherit', env });
}

async function runIntegrationTest() {
  let composeStarted = false;
  let fastifyApp = null;

  try {
    // C-01 / C-03: Verificación estricta de Docker (FAIL CLOSED con THROW, sin process.exit prematuro)
    const dockerOk = await checkDockerAvailable();
    if (!dockerOk) {
      throw new Error('REAL_PG16_AND_REDIS_REQUIRED: Docker Engine no está activo ni disponible.');
    }

    console.log('🐳 Levantando contenedores PostgreSQL 16 y Redis 7 reales en Docker Compose...');
    try {
      execSync('docker compose -f docker-compose.audit.yml up -d', { stdio: 'inherit' });
      composeStarted = true;
    } catch (composeErr) {
      throw new Error(`REAL_PG16_AND_REDIS_REQUIRED: Falló docker compose up: ${composeErr.message}`);
    }

    console.log('⏳ Esperando disponibilidad de PostgreSQL 16 en 127.0.0.1:15432...');
    const dbReady = await waitForDb(ADMIN_URL);
    if (!dbReady) {
      throw new Error('REAL_PG16_AND_REDIS_REQUIRED: PostgreSQL 16 no respondió en 127.0.0.1:15432.');
    }
    console.log('✅ PostgreSQL 16 en Docker Compose conectado exitosamente.');

    // RONDAS 1 Y 2 PARA PROBAR FASES PRODUCTIVAS E IDEMPOTENCIA
    for (let round = 1; round <= 2; round++) {
      console.log(`\n--- FASE ${round}: EJECUCIÓN PRODUCTIVA (RONDA ${round} DE IDEMPOTENCIA) ---`);
      
      // 1. Pre-bootstrap
      runScript('scripts/bootstrap-pre.mjs');

      // 2. C-02: Asignación explícita de contraseña al rol runtime politica_canon_app para entorno de prueba
      console.log(`🔑 [C-02 TEST SETUP] Asignando contraseña exclusiva de prueba al rol runtime 'politica_canon_app'...`);
      const adminClient = new Client({ connectionString: ADMIN_URL });
      await adminClient.connect();
      await adminClient.query(`ALTER ROLE politica_canon_app WITH PASSWORD '${APP_TEST_PASSWORD}';`);
      console.log("✅ [C-02 TEST SETUP] Contraseña de prueba asignada a 'politica_canon_app'.");

      // 3. Migración DDL
      runScript('scripts/migrate-production.mjs');

      // 4. Post-bootstrap
      runScript('scripts/bootstrap-post.mjs');

      // 5. Aserciones de Catálogo en PostgreSQL 16 Real
      console.log(`\n--- ASERCIONES DE CATÁLOGO PG16 REAL (RONDA ${round}) ---`);
      const ownerCheck = await adminClient.query("SELECT pg_catalog.pg_get_userbyid(datdba) AS db_owner FROM pg_catalog.pg_database WHERE datname = 'politica_canon';");
      const dbOwner = ownerCheck.rows[0]?.db_owner;
      if (dbOwner !== 'app_owner') {
        throw new Error(`CRITICAL FAIL: datdba es '${dbOwner}', se requiere 'app_owner'.`);
      }
      console.log(`✅ Catálogo PG16: datdba = '${dbOwner}' (app_owner verificado).`);

      const dispCheck = await adminClient.query("SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'audit_dispatcher';");
      if (!dispCheck.rows[0]?.rolbypassrls) {
        throw new Error('CRITICAL FAIL: audit_dispatcher no tiene BYPASSRLS activado.');
      }
      console.log('✅ Catálogo PG16: audit_dispatcher BYPASSRLS = true.');

      const funcCheck = await adminClient.query(`
        SELECT pg_get_userbyid(p.proowner) as func_owner
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'get_pending_outbox_tenants';
      `);
      if (funcCheck.rows[0]?.func_owner !== 'audit_dispatcher') {
        throw new Error(`CRITICAL FAIL: get_pending_outbox_tenants es propiedad de '${funcCheck.rows[0]?.func_owner}', se requiere 'audit_dispatcher'.`);
      }
      console.log('✅ Catálogo PG16: get_pending_outbox_tenants pertenece a audit_dispatcher.');

      // Probar denegación DML sobre app_user
      await adminClient.query('SET ROLE app_user;');
      let dmlDenied = false;
      try {
        await adminClient.query("INSERT INTO decisions (id, organization_id, workspace_id, authority_body_id, document_id, version_id, submission_id, title) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Title');");
      } catch (err) {
        if (err.message.includes('permission denied')) {
          dmlDenied = true;
        }
      }
      if (!dmlDenied) {
        throw new Error('CRITICAL FAIL: app_user no recibió permission denied al intentar DML.');
      }
      console.log('✅ Catálogo PG16: Denegación DML para app_user verificada.');

      await adminClient.query('RESET ROLE;');
      await adminClient.end();
    }

    // VERIFICACIÓN CON SERVICIOS REALES FASTIFY /readyz HTTP 200 (C-02)
    console.log('\n--- VERIFICACIÓN HTTP FASTIFY CON CONEXIONES REALES (PG16 + REDIS 7) ---');
    const { buildServer } = await import('../dist/server.js');
    fastifyApp = buildServer();
    await fastifyApp.ready();

    const healthRes = await fastifyApp.inject({ method: 'GET', url: '/healthz' });
    const readyRes = await fastifyApp.inject({ method: 'GET', url: '/readyz' });
    const rootRes = await fastifyApp.inject({ method: 'GET', url: '/' });

    console.log(`  -> GET /healthz: ${healthRes.statusCode}`);
    console.log(`  -> GET /readyz: ${readyRes.statusCode} payload=${readyRes.payload}`);
    console.log(`  -> GET /: ${rootRes.statusCode}`);

    if (healthRes.statusCode !== 200) {
      throw new Error(`GET /healthz devolvió status ${healthRes.statusCode}, se requiere 200.`);
    }

    const readyBody = JSON.parse(readyRes.payload);
    if (readyRes.statusCode !== 200 || readyBody.status !== 'ready' || readyBody.database !== 'connected' || readyBody.redis !== 'connected') {
      throw new Error(`CRITICAL FAIL (C-02): GET /readyz devolvió HTTP ${readyRes.statusCode} (${readyRes.payload}), se requiere HTTP 200 'ready' con database='connected' y redis='connected'.`);
    }

    console.log('✅ PROBES HTTP FASTIFY: GET /readyz = 200 {"status":"ready","database":"connected","redis":"connected"} CONFIRMADO EXITOSAMENTE.');
    console.log('\n🎉 GATE DE INTEGRACIÓN REAL v0.3.9 COMPLETO Y CERTIFICADO');

  } finally {
    // H-01 / C-03: Limpieza incondicional en bloque finally (SE GARANTIZA SU EJECUCIÓN AL LANZAR THROW EN LUGAR DE PROCESS.EXIT)
    if (fastifyApp) {
      await fastifyApp.close().catch(() => {});
    }

    if (composeStarted) {
      console.log('\n🧹 [H-01/C-03 FINALLY CLEANUP] Destruyendo contenedores y volúmenes de prueba Docker Compose (down -v)...');
      try {
        execSync('docker compose -f docker-compose.audit.yml down -v', { stdio: 'inherit' });
        console.log('✅ [H-01/C-03 FINALLY CLEANUP] Recursos Docker destruidos incondicionalmente en finally.');
      } catch (downErr) {
        console.warn('⚠️ Error al destruir contenedores Docker:', downErr.message);
      }
    }
  }
}

runIntegrationTest().catch((err) => {
  console.error('\n❌ ERROR FATAL EN PRUEBA DE INTEGRACIÓN PG16:', err.message);
  process.exit(1);
});
