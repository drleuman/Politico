import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL || process.env.POLITICA_CANON_DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ ERROR FATAL: Ni DATABASE_URL ni POLITICA_CANON_DATABASE_URL están definidas en el entorno.');
    process.exit(1);
  }

  console.log(`🚀 [MIGRADOR v0.3.0] Conectando a PostgreSQL: ${maskConnectionString(dbUrl)}`);

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log('✅ Conexión a PostgreSQL establecida correctamente.');

    // 1. Crear tabla de control de migraciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
    const migrationFiles = ['0001_initial_schema.sql'];

    // 2. Ejecutar cada migración dentro de una transacción atómica idempotente
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo de migración no encontrado: ${filePath}`);
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');

      const existing = await client.query('SELECT checksum FROM schema_migrations WHERE filename = $1', [file]);
      if (existing.rows.length > 0) {
        console.log(`ℹ️ [OMITIDO] Migración '${file}' ya fue ejecutada previamente (Checksum: ${existing.rows[0].checksum.slice(0, 8)}...).`);
        continue;
      }

      console.log(`⏳ [EJECUTANDO] Aplicando migración '${file}'...`);
      await client.query('BEGIN');
      await client.query(content);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [file, checksum]
      );
      await client.query('COMMIT');
      console.log(`✅ [APLICADO] Migración '${file}' completada exitosamente.`);
    }

    console.log('🎉 [MIGRADOR v0.3.0] Todas las migraciones fueron verificadas y aplicadas satisfactoriamente.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ ERROR DURANTE LA MIGRACIÓN:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

runMigration();
