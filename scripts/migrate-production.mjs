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
    return '<invalid-url>';
  }
}

async function runMigration() {
  const dbUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || process.env.POLITICA_CANON_DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ ERROR FATAL: Ni MIGRATION_DATABASE_URL, DATABASE_URL ni POLITICA_CANON_DATABASE_URL están definidas.');
    process.exit(1);
  }

  console.log(`🚀 [MIGRADOR DDL v0.3.3] Conectando a PostgreSQL: ${maskConnectionString(dbUrl)}`);

  const client = new Client({ connectionString: dbUrl });
  let hasLock = false;

  try {
    await client.connect();
    console.log('✅ Conexión a PostgreSQL establecida correctamente.');

    // 1. C-02: Establecer rol propietario de esquema app_owner para la sesión de migración DDL
    try {
      await client.query('SET ROLE app_owner;');
      console.log('👑 [C-02] Rol de sesión cambiado exitosamente a \'app_owner\'.');
    } catch (roleErr) {
      console.warn('⚠️ [AVISO C-02] No se pudo ejecutar SET ROLE app_owner (puede que la conexión ya sea el propietario o rol administrador):', roleErr.message);
    }

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

    // 4. Descubrir todos los archivos de migración .sql ordenados
    const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Directorio de migraciones no encontrado: ${migrationsDir}`);
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && !file.endsWith('_down.sql'))
      .sort();

    console.log(`📋 Encontradas ${migrationFiles.length} migraciones en db/migrations/: ${migrationFiles.join(', ')}`);

    // 5. Verificar integridad y aplicar migraciones pendientes
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const currentChecksum = crypto.createHash('sha256').update(content).digest('hex');

      const existing = await client.query('SELECT checksum FROM schema_migrations WHERE filename = $1;', [file]);

      if (existing.rows.length > 0) {
        const recordedChecksum = existing.rows[0].checksum;
        if (recordedChecksum !== currentChecksum) {
          console.error(`❌ ERROR FATAL DE INTEGRIDAD (CHECKSUM_MISMATCH): La migración '${file}' ya fue ejecutada con checksum '${recordedChecksum}', pero el archivo en disco tiene checksum '${currentChecksum}'. Abortando por fallo cerrado.`);
          process.exit(1);
        }
        console.log(`ℹ️ [VERIFICADO] Migración '${file}' previamente aplicada e intacta (Checksum: ${currentChecksum.slice(0, 8)}...).`);
        continue;
      }

      console.log(`⏳ [EJECUTANDO] Aplicando migración '${file}' con propiedad 'app_owner'...`);
      await client.query('BEGIN;');
      await client.query(content);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2);',
        [file, currentChecksum]
      );
      await client.query('COMMIT;');
      console.log(`✅ [APLICADO] Migración '${file}' completada exitosamente.`);
    }

    console.log('🎉 [MIGRADOR DDL v0.3.3] Todas las migraciones fueron verificadas y aplicadas bajo propiedad \'app_owner\'.');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ ERROR DURANTE LA MIGRACIÓN DE PRODUCCIÓN:', err.message);
    process.exit(1);
  } finally {
    if (hasLock) {
      await client.query('SELECT pg_advisory_unlock($1);', [MIGRATION_LOCK_ID]).catch(() => {});
      console.log('🔓 Bloqueo de migración liberado.');
    }
    await client.end().catch(() => {});
  }
}

runMigration();
