import fs from 'fs';
import path from 'path';
import pg from 'pg';
const { Client } = pg;

function maskConnectionString(urlStr) {
  if (!urlStr) return '<empty>';
  try {
    const parsed = new URL(urlStr);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return '<invalid-url>';
  }
}

async function runPreBootstrap() {
  let adminUrl = process.env.POLITICA_CANON_ADMIN_DATABASE_URL;
  let clientConfig;

  if (adminUrl) {
    console.log(`🔒 [FASE 1: PRE-BOOTSTRAP ROLES] Conectando vía URL administrativa: ${maskConnectionString(adminUrl)}`);
    clientConfig = { connectionString: adminUrl };
  } else if (process.platform === 'linux') {
    console.log('🔒 [FASE 1: PRE-BOOTSTRAP ROLES] Conectando vía socket Unix local (/var/run/postgresql) a base \'politica_canon\'...');
    clientConfig = { host: '/var/run/postgresql', database: 'politica_canon' };
  } else {
    adminUrl = process.env.DATABASE_URL;
    if (!adminUrl) {
      console.error('❌ ERROR FATAL: Ni POLITICA_CANON_ADMIN_DATABASE_URL ni DATABASE_URL están definidas.');
      process.exit(1);
    }
    clientConfig = { connectionString: adminUrl };
  }

  const client = new Client(clientConfig);
  try {
    await client.connect();
    
    // 1. C-01: Verificación estricta de base de datos target
    const dbRes = await client.query('SELECT current_database();');
    const currentDb = dbRes.rows[0]?.current_database || '';
    if (currentDb !== 'politica_canon') {
      console.error(`❌ ERROR FATAL (C-01): La conexión apunta a la base de datos '${currentDb}', pero la Fase 1 exige conectarse explícitamente a 'politica_canon'. Abortando.`);
      process.exit(1);
    }

    // 2. Verificación estricta de Superusuario
    const userRes = await client.query('SELECT current_user, usesuper FROM pg_user WHERE usename = current_user;');
    const currentUser = userRes.rows[0]?.current_user || 'unknown';
    const isSuper = userRes.rows[0]?.usesuper || false;
    
    console.log(`ℹ️ Conectado a BD '${currentDb}' como usuario PostgreSQL: '${currentUser}' (Superusuario: ${isSuper})`);

    if (!isSuper) {
      console.error(`❌ ERROR FATAL (PRIVILEGE_VIOLATION): El Pre-bootstrap debe ejecutarse exclusivamente con privilegios de SUPERUSUARIO. Usuario conectado: '${currentUser}'.`);
      process.exit(1);
    }

    const sqlPath = path.resolve(process.cwd(), 'db/0000_bootstrap_roles.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Archivo db/0000_bootstrap_roles.sql no encontrado en: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('⏳ [EJECUTANDO FASE 1] Aplicando db/0000_bootstrap_roles.sql (Creación de roles app_owner, app_user, audit_* y politica_canon_app)...');
    await client.query('BEGIN;');
    await client.query(sqlContent);
    await client.query('COMMIT;');
    console.log('✅ [FASE 1 COMPLETADA] Roles de seguridad canónicos y rol runtime configurados exitosamente.');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ ERROR DURANTE FASE 1 PRE-BOOTSTRAP:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

runPreBootstrap();
