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
  const adminUrl = process.env.POLITICA_CANON_ADMIN_DATABASE_URL || 
                   (process.platform === 'linux' ? 'postgresql:///?host=/var/run/postgresql&dbname=politica_canon' : process.env.DATABASE_URL);
  
  if (!adminUrl) {
    console.error('❌ ERROR FATAL: Ni POLITICA_CANON_ADMIN_DATABASE_URL ni DATABASE_URL están definidas.');
    process.exit(1);
  }

  console.log(`🔒 [FASE 3: POST-BOOTSTRAP PERMISOS & RLS] Conectando a PostgreSQL: ${maskConnectionString(adminUrl)}`);

  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    
    // Verificación estricta de Superusuario
    const userRes = await client.query('SELECT current_user, usesuper FROM pg_user WHERE usename = current_user;');
    const currentUser = userRes.rows[0]?.current_user || 'unknown';
    const isSuper = userRes.rows[0]?.usesuper || false;
    
    console.log(`ℹ️ Usuario PostgreSQL conectado: '${currentUser}' (Superusuario: ${isSuper})`);

    if (!isSuper) {
      console.error(`❌ ERROR FATAL (PRIVILEGE_VIOLATION): El Post-bootstrap debe ejecutarse exclusivamente con privilegios de SUPERUSUARIO. Usuario conectado: '${currentUser}'.`);
      process.exit(1);
    }

    const sqlPath = path.resolve(process.cwd(), 'db/0002_bootstrap_permissions.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Archivo db/0002_bootstrap_permissions.sql no encontrado en: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('⏳ [EJECUTANDO FASE 3] Aplicando db/0002_bootstrap_permissions.sql (Propiedad app_owner, permisos mínimos app_user y RLS obligatorio)...');
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');
    console.log('✅ [FASE 3 COMPLETADA] Propiedad de objetos, revocaciones de seguridad e imposición de RLS finalizadas exitosamente.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ ERROR DURANTE FASE 3 POST-BOOTSTRAP:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

runPostBootstrap();
