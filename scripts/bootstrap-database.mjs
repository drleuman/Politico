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

async function runBootstrap() {
  const adminUrl = process.env.POLITICA_CANON_ADMIN_DATABASE_URL || process.env.DATABASE_URL;
  if (!adminUrl) {
    console.error('❌ ERROR FATAL: Ni POLITICA_CANON_ADMIN_DATABASE_URL ni DATABASE_URL están definidas en el entorno.');
    process.exit(1);
  }

  console.log(`🔒 [BOOTSTRAP ROLES v0.3.1] Conectando a PostgreSQL con credencial de administración: ${maskConnectionString(adminUrl)}`);

  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    
    // Verificar rol de administración
    const userRes = await client.query('SELECT current_user, usesuper FROM pg_user WHERE usename = current_user;');
    const currentUser = userRes.rows[0]?.current_user || 'unknown';
    const isSuper = userRes.rows[0]?.usesuper || false;
    
    console.log(`ℹ️ Usuario PostgreSQL conectado: '${currentUser}' (Superusuario: ${isSuper})`);

    const bootstrapPath = path.resolve(process.cwd(), 'db/bootstrap_roles.sql');
    if (!fs.existsSync(bootstrapPath)) {
      throw new Error(`Archivo db/bootstrap_roles.sql no encontrado en: ${bootstrapPath}`);
    }

    const sqlContent = fs.readFileSync(bootstrapPath, 'utf8');

    console.log('⏳ [EJECUTANDO] Aplicando db/bootstrap_roles.sql (Creación de roles, revocación de permisos directos y RLS)...');
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');
    console.log('✅ [BOOTSTRAP COMPLETADO] Roles de seguridad, grupos y permisos mínimos aplicados exitosamente.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ ERROR DURANTE EL BOOTSTRAP DE ROLES:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

runBootstrap();
