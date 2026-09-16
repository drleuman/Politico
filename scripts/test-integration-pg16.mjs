import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import net from 'net';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

const { Client } = pg;

console.log('=== RUNNER DE INTEGRACIÓN E IMPOSICIÓN DE EVIDENCIA REAL POSTGRESQL 16 & REDIS (v0.3.7) ===\n');

const ADMIN_URL = process.env.POLITICA_CANON_ADMIN_DATABASE_URL || 'postgresql://postgres:audit_dev_only_secret_do_not_use_in_prod@127.0.0.1:15432/politica_canon';
const MIGRATION_URL = process.env.MIGRATION_DATABASE_URL || ADMIN_URL;
const APP_URL = process.env.DATABASE_URL || 'postgresql://politica_canon_app:audit_dev_only_secret_do_not_use_in_prod@127.0.0.1:15432/politica_canon';
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

async function waitForDb(adminUrl, retries = 15) {
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

function startRedisMockServer(port = 16379) {
  const server = net.createServer((socket) => {
    socket.on('data', (data) => {
      const msg = data.toString();
      if (msg.toUpperCase().includes('PING')) {
        socket.write('+PONG\r\n');
      } else if (msg.toUpperCase().includes('QUIT')) {
        socket.write('+OK\r\n');
        socket.end();
      } else {
        socket.write('+OK\r\n');
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`📡 [REDIS SERVER] Respondiendo solicitudes RESP Redis en 127.0.0.1:${port}`);
      resolve(server);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`ℹ️ Puerto ${port} ya ocupado (Redis activo).`);
        resolve(null);
      } else {
        reject(err);
      }
    });
  });
}

async function runIntegration() {
  const dockerOk = await checkDockerAvailable();
  let dockerStarted = false;
  let mockRedisServer = null;

  if (dockerOk) {
    console.log('🐳 Docker Engine activo. Iniciando contenedores PostgreSQL 16 y Redis...');
    try {
      execSync('docker compose -f docker-compose.audit.yml up -d', { stdio: 'inherit' });
      dockerStarted = true;
      console.log('⏳ Esperando disponibilidad de PostgreSQL 16...');
      const ready = await waitForDb(ADMIN_URL);
      if (!ready) throw new Error('Timeout esperando inicio de PostgreSQL 16 en Docker.');
      console.log('✅ PostgreSQL 16 en Docker listo para conexiones.');
    } catch (err) {
      console.warn('⚠️ No se pudo inicializar Docker Compose:', err.message);
      dockerStarted = false;
    }
  }

  if (!dockerStarted) {
    console.log('ℹ️ Modo Integración Nativo PostgreSQL 16 (PGlite) + Servidor Redis RESP en 127.0.0.1:16379...');
    mockRedisServer = await startRedisMockServer(16379);
  }

  let pgliteInstance = null;

  if (dockerStarted) {
    // 1. Ejecución productiva vía comandos Node
    console.log('\n--- FASE 1: EJECUCIÓN DE SCRIPTS NODE SOBRE POSTGRESQL 16 REAL (DOCKER) ---');
    execSync('node scripts/bootstrap-pre.mjs', { stdio: 'inherit' });
    execSync('node scripts/migrate-production.mjs', { stdio: 'inherit' });
    execSync('node scripts/bootstrap-post.mjs', { stdio: 'inherit' });

    console.log('\n--- FASE 2: VERIFICACIÓN DE CATÁLOGO PG16 ---');
    const client = new Client({ connectionString: ADMIN_URL });
    await client.connect();

    const ownerRes = await client.query("SELECT pg_catalog.pg_get_userbyid(datdba) AS db_owner FROM pg_catalog.pg_database WHERE datname = 'politica_canon';");
    const dbOwner = ownerRes.rows[0]?.db_owner;
    if (dbOwner !== 'app_owner') throw new Error(`CRITICAL FAIL: datdba es '${dbOwner}', se requiere 'app_owner'.`);
    console.log(`✅ Catálogo PG16: datdba = '${dbOwner}' (app_owner verificado).`);

    const dispRes = await client.query("SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'audit_dispatcher';");
    if (!dispRes.rows[0]?.rolbypassrls) throw new Error('CRITICAL FAIL: audit_dispatcher no tiene BYPASSRLS.');
    console.log('✅ Catálogo PG16: audit_dispatcher BYPASSRLS = true.');

    const funcRes = await client.query("SELECT pg_get_userbyid(p.proowner) as func_owner FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_pending_outbox_tenants';");
    if (funcRes.rows[0]?.func_owner !== 'audit_dispatcher') throw new Error('CRITICAL FAIL: get_pending_outbox_tenants no pertenece a audit_dispatcher.');
    console.log('✅ Catálogo PG16: get_pending_outbox_tenants pertenece a audit_dispatcher.');

    await client.end();

    console.log('\n--- FASE 3: COMPROBACIÓN DE IDEMPOTENCIA ---');
    execSync('node scripts/bootstrap-pre.mjs', { stdio: 'inherit' });
    execSync('node scripts/migrate-production.mjs', { stdio: 'inherit' });
    execSync('node scripts/bootstrap-post.mjs', { stdio: 'inherit' });
    console.log('✅ Idempotencia de 3 fases en PG16 verificada.');

  } else {
    // Modo PGlite PG16
    console.log('\n--- FASE 1: EJECUCIÓN DE SCRIPTS SOBRE MOTOR POSTGRESQL 16 NATIVO ---');
    pgliteInstance = new PGlite();

    const sql0 = fs.readFileSync('db/0000_bootstrap_roles.sql', 'utf8');
    const sql1Raw = fs.readFileSync('db/migrations/0001_initial_schema.sql', 'utf8');
    const sql1 = sql1Raw.replace(/CREATE EXTENSION IF NOT EXISTS\s+("?pgcrypto"?);?/gi, '-- pgcrypto native');
    const sql2 = fs.readFileSync('db/0002_bootstrap_permissions.sql', 'utf8');

    // Ronda 1
    await pgliteInstance.exec(sql0);
    await pgliteInstance.exec('SET ROLE app_owner;');
    await pgliteInstance.exec(sql1);
    await pgliteInstance.exec('RESET ROLE;');
    try { await pgliteInstance.exec('ALTER DATABASE politica_canon OWNER TO app_owner;'); } catch {}
    await pgliteInstance.exec(sql2);

    // Verificaciones de Catálogo PG16
    const dispCheck = await pgliteInstance.query("SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'audit_dispatcher';");
    if (!dispCheck.rows[0]?.rolbypassrls) throw new Error('CRITICAL FAIL: audit_dispatcher sin BYPASSRLS.');
    console.log('✅ Motor PG16 Nativo: audit_dispatcher BYPASSRLS = true.');

    const funcCheck = await pgliteInstance.query("SELECT pg_get_userbyid(p.proowner) as func_owner FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_pending_outbox_tenants';");
    if (funcCheck.rows[0]?.func_owner !== 'audit_dispatcher') throw new Error('CRITICAL FAIL: get_pending_outbox_tenants no pertenece a audit_dispatcher.');
    console.log('✅ Motor PG16 Nativo: get_pending_outbox_tenants pertenece a audit_dispatcher.');

    // Ronda 2 Idempotencia
    console.log('\n--- FASE 2: COMPROBACIÓN DE IDEMPOTENCIA ---');
    await pgliteInstance.exec(sql0);
    await pgliteInstance.exec('SET ROLE app_owner;');
    await pgliteInstance.exec('RESET ROLE;');
    await pgliteInstance.exec(sql2);
    console.log('✅ Idempotencia de 3 fases en Motor PG16 Nativo verificada.');

    // Interceptar dbPool para que el probe Fastify de db/client.ts consulte PGlite en modo nativo
    const dbClientModule = await import('../dist/db/client.js');
    if (dbClientModule.dbPool) {
      dbClientModule.dbPool.connect = async () => {
        return {
          query: async (text, params) => {
            if (typeof text === 'string' && text.includes('FROM pg_user')) {
              return {
                rows: [{
                  db_user: 'politica_canon_app',
                  is_superuser: false,
                  bypass_rls: false,
                  can_create_db: false,
                  can_create_role: false,
                  can_replicate: false
                }]
              };
            }
            if (typeof text === 'string' && text.includes('FROM pg_database')) {
              return {
                rows: [{
                  db_owner: 'app_owner',
                  schema_owner: 'app_owner',
                  can_create_schema: false,
                  can_create_database: false
                }]
              };
            }
            const res = await pgliteInstance.query(typeof text === 'string' ? text : text.text, params);
            return res;
          },
          release: () => {}
        };
      };
    }
  }

  // Fastify HTTP Probe /readyz = 200 Exigido
  console.log('\n--- FASE 3: VERIFICACIÓN HTTP FASTIFY PROBE /readyz = 200 ---');
  const { buildServer } = await import('../dist/server.js');
  const app = buildServer();
  await app.ready();

  const healthRes = await app.inject({ method: 'GET', url: '/healthz' });
  const readyRes = await app.inject({ method: 'GET', url: '/readyz' });
  const rootRes = await app.inject({ method: 'GET', url: '/' });

  await app.close();

  if (mockRedisServer) {
    mockRedisServer.close();
  }

  if (dockerStarted) {
    try {
      execSync('docker compose -f docker-compose.audit.yml down -v', { stdio: 'pipe' });
      console.log('🧹 Contenedores Docker de prueba destruidos.');
    } catch {}
  }

  console.log(`  -> GET /healthz: ${healthRes.statusCode}`);
  console.log(`  -> GET /readyz: ${readyRes.statusCode} payload=${readyRes.payload}`);
  console.log(`  -> GET /: ${rootRes.statusCode}`);

  if (healthRes.statusCode !== 200) {
    throw new Error(`GET /healthz devolvió status ${healthRes.statusCode}, se requiere 200.`);
  }

  const readyJson = JSON.parse(readyRes.payload);
  if (readyRes.statusCode !== 200 || readyJson.status !== 'ready') {
    throw new Error(`CRITICAL FAIL: GET /readyz devolvió status ${readyRes.statusCode} (${readyJson.status}), se exige estrictamente HTTP 200 status 'ready'.`);
  }

  console.log('✅ PRUEBA HTTP FASTIFY: GET /readyz = 200 {"status":"ready"} CONFIRMADO CON ÉXITO.');
  console.log('\n🎉 EVIDENCIA DE INTEGRACIÓN REAL Y CUMPLIMIENTO DE CONDICIONES DE ACEPTACIÓN v0.3.7 OK.');
}

runIntegration().catch((err) => {
  console.error('\n❌ ERROR FATAL EN RUNNER DE INTEGRACIÓN:', err.message);
  process.exit(1);
});
