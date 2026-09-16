import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
const { Client } = pg;

const MIGRATION_LOCK_ID = 87850301; // Advisory Lock ID único para Política Canon

function maskConnectionString(urlStr) {
  if (!urlStr) return '<empty>';
  try {
    const parsed = new URL(urlStr);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return '<unix-socket>';
  }
}

async function runMigration() {
  const dbUrl = process.env.MIGRATION_DATABASE_URL || process.env.POLITICA_CANON_DATABASE_URL || 'postgresql:///politica_canon?host=/var/run/postgresql';

  console.log(`🚀 [MIGRADOR DDL v0.3.4] Conectando a PostgreSQL: ${maskConnectionString(dbUrl)}`);

  const client = new Client({ connectionString: dbUrl });
  let hasLock = false;

  try {
    await client.connect();
    console.log('✅ Conexión a PostgreSQL establecida correctamente.');

    // 1. C-01 / C-02: Establecer rol propietario de esquema app_owner para la sesión de migración DDL
    try {
      await client.query('SET ROLE app_owner;');
      console.log('👑 [C-01/C-02] Sentencia SET ROLE app_owner ejecutada.');
    } catch (roleErr) {
      console.error('❌ ERROR FATAL C-01: No se pudo asumir el rol app_owner en la sesión de migración:', roleErr.message);
      process.exit(1);
    }

    // Comprobar estrictamente que el usuario activo de la sesión sea app_owner
    const userRes = await client.query('SELECT current_user, session_user;');
    const currentUser = userRes.rows[0]?.current_user;
    if (currentUser !== 'app_owner') {
      console.error(`❌ ERROR FATAL C-01: current_user = '${currentUser}', se requiere estrictamente 'app_owner' para ejecutar migraciones DDL.`);
      process.exit(1);
    }
    console.log(`✅ [C-01/C-02] Rol de sesión confirmado: current_user = '${currentUser}' (session_user = '${userRes.rows[0]?.session_user}').`);

    // 2. Tomar bloqueo de asesoramiento concurrente (Advisory Lock)
    console.log(`🔒 Solicitando bloqueo de migración concurrente (Advisory Lock: ${MIGRATION_LOCK_ID})...`);
    await client.query('SELECT pg_advisory_lock($1);', [MIGRATION_LOCK_ID]);
    hasLock = true;
    console.log('🔒 Bloqueo de migración obtenido en exclusiva.');

    // 3. Crear tabla de control de migraciones si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Leer archivos de migración desde db/migrations
    const migrationsDir = path.resolve('db', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error(`❌ ERROR FATAL: El directorio de migraciones no existe: ${migrationsDir}`);
      process.exit(1);
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.endsWith('_down.sql'))
      .sort();

    console.log(`📂 Se encontraron ${migrationFiles.length} archivos de migración DDL.`);

    // 5. Aplicar migraciones pendientes con verificación fail-closed de checksums
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const currentChecksum = crypto.createHash('sha256').update(content).digest('hex');

      const existing = await client.query(
        'SELECT checksum FROM schema_migrations WHERE filename = $1;',
        [file]
      );

      if (existing.rows.length > 0) {
        const storedChecksum = existing.rows[0].checksum;
        if (storedChecksum !== currentChecksum) {
          console.error(`❌ ERROR FATAL [CHECKSUM_MISMATCH]: La migración ${file} ha sido alterada post-aplicación.`);
          console.error(`   Esperado: ${storedChecksum}`);
          console.error(`   Calculado: ${currentChecksum}`);
          process.exit(1);
        }
        console.log(`⏭️ Migración ${file} ya fue aplicada (checksum verificado).`);
        continue;
      }

      console.log(`▶️ Aplicando migración DDL: ${file}...`);
      await client.query('BEGIN;');
      try {
        await client.query(content);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2);',
          [file, currentChecksum]
        );
        await client.query('COMMIT;');
        console.log(`✅ Migración ${file} aplicada exitosamente.`);
      } catch (migErr) {
        await client.query('ROLLBACK;');
        console.error(`❌ ERROR FATAL al aplicar la migración ${file}:`, migErr);
        process.exit(1);
      }
    }

    console.log('🎉 Migración DDL de producción completada exitosamente.');

  } catch (err) {
    console.error('❌ ERROR FATAL en el proceso de migración:', err);
    process.exit(1);
  } finally {
    if (hasLock) {
      try {
        await client.query('SELECT pg_advisory_unlock($1);', [MIGRATION_LOCK_ID]);
        console.log('🔓 Bloqueo de migración liberado.');
      } catch (unlockErr) {
        console.error('⚠️ No se pudo liberar el advisory lock:', unlockErr);
      }
    }
    await client.end();
  }
}

runMigration();
