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

async function runPostBootstrap() {
  let adminUrl = process.env.POLITICA_CANON_ADMIN_DATABASE_URL;
  let clientConfig;

  if (adminUrl) {
    console.log(`🔒 [FASE 3: POST-BOOTSTRAP PERMISOS & RLS] Conectando vía URL administrativa: ${maskConnectionString(adminUrl)}`);
    clientConfig = { connectionString: adminUrl };
  } else if (process.platform === 'linux') {
    console.log('🔒 [FASE 3: POST-BOOTSTRAP PERMISOS & RLS] Conectando vía socket Unix local (/var/run/postgresql) a base \'politica_canon\'...');
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
      console.error(`❌ ERROR FATAL (C-01): La conexión apunta a la base de datos '${currentDb}', pero la Fase 3 exige conectarse explícitamente a 'politica_canon'. Abortando.`);
      process.exit(1);
    }

    // 2. Verificación estricta de Superusuario
    const userRes = await client.query('SELECT current_user, usesuper FROM pg_user WHERE usename = current_user;');
    const currentUser = userRes.rows[0]?.current_user || 'unknown';
    const isSuper = userRes.rows[0]?.usesuper || false;
    
    console.log(`ℹ️ Conectado a BD '${currentDb}' como usuario PostgreSQL: '${currentUser}' (Superusuario: ${isSuper})`);

    if (!isSuper) {
      console.error(`❌ ERROR FATAL (PRIVILEGE_VIOLATION): El Post-bootstrap debe ejecutarse exclusivamente con privilegios de SUPERUSUARIO. Usuario conectado: '${currentUser}'.`);
      process.exit(1);
    }

    const sqlPath = path.resolve(process.cwd(), 'db/0002_bootstrap_permissions.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Archivo db/0002_bootstrap_permissions.sql no encontrado en: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // C-01 v0.3.6: ALTER DATABASE no puede ejecutarse dentro de transacciones y DEBE fallar cerrado si falla
    console.log("👑 [FASE 3 C-01] Transfiriendo propiedad de la base de datos 'politica_canon' a 'app_owner' (consulta no transaccional)...");
    try {
      await client.query('ALTER DATABASE politica_canon OWNER TO app_owner;');
      console.log("✅ Propiedad de la base de datos 'politica_canon' asignada exitosamente a 'app_owner'.");
    } catch (dbOwnerErr) {
      console.error("❌ ERROR FATAL (C-01): Falló la transferencia de propiedad de la base de datos 'politica_canon' a 'app_owner':", dbOwnerErr.message);
      process.exit(1);
    }

    // Verificación estricta mediante catálogo de que datdba = app_owner
    const ownerCheckRes = await client.query("SELECT pg_catalog.pg_get_userbyid(datdba) AS db_owner FROM pg_catalog.pg_database WHERE datname = 'politica_canon';");
    const actualOwner = ownerCheckRes.rows[0]?.db_owner;
    if (actualOwner !== 'app_owner') {
      console.error(`❌ ERROR FATAL (C-01): Verificación de catálogo fallida. Propietario actual de 'politica_canon' es '${actualOwner}', se requiere 'app_owner'. Abortando.`);
      process.exit(1);
    }
    console.log("✅ Verificación de catálogo confirmada: propietario de la base de datos es 'app_owner'.");

    console.log('⏳ [EJECUTANDO FASE 3] Aplicando db/0002_bootstrap_permissions.sql (Propiedad app_owner, permisos mínimos app_user y RLS obligatorio)...');
    await client.query('BEGIN;');
    await client.query(sqlContent);
    await client.query('COMMIT;');
    console.log('✅ [FASE 3 COMPLETADA] Propiedad de objetos, revocaciones de seguridad e imposición de RLS finalizadas exitosamente.');

    // Aserciones de catálogo C-02 y C-03
    const fnOwnerRes = await client.query(`
      SELECT pg_catalog.pg_get_userbyid(p.proowner) AS owner_name
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'revoke_all_user_sessions_sec';
    `);
    const fnOwner = fnOwnerRes.rows[0]?.owner_name;
    if (fnOwner !== 'token_resolver') {
      console.error(`❌ ERROR FATAL (C-03): revoke_all_user_sessions_sec pertenece a '${fnOwner}', se requiere 'token_resolver'.`);
      process.exit(1);
    }
    console.log(`✅ Catálogo PG16: revoke_all_user_sessions_sec pertenece a '${fnOwner}' (BYPASSRLS).`);
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ ERROR DURANTE FASE 3 POST-BOOTSTRAP:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

runPostBootstrap();
