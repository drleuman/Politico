import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

export const dbPool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function checkDatabaseHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await dbPool.connect();
    try {
      const res = await client.query(`
        SELECT 
          current_user AS db_user, 
          usesuper AS is_superuser, 
          rolbypassrls AS bypass_rls
        FROM pg_user 
        WHERE usename = current_user;
      `);
      
      if (res.rows.length > 0) {
        const { db_user, is_superuser, bypass_rls } = res.rows[0];
        if (is_superuser || bypass_rls) {
          return {
            ok: false,
            error: `VIOLACIÓN DE INVARIANTE DE SEGURIDAD (C-02): El rol '${db_user}' tiene privilegios administrativos (superuser=${is_superuser}, bypassrls=${bypass_rls}). La aplicación exige un rol unprivileged con RLS obligatorio.`,
          };
        }
      }

      await client.query('SELECT 1;');
      return { ok: true };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Database query failed' };
  }
}

export async function closeDbPool(): Promise<void> {
  try {
    await dbPool.end();
  } catch (err: any) {
    console.error('Error cerrando pool de base de datos:', err.message);
  }
}

