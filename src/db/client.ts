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
          rolbypassrls AS bypass_rls,
          rolcreatedb AS can_create_db,
          rolcreaterole AS can_create_role,
          rolreplication AS can_replicate
        FROM pg_user 
        WHERE usename = current_user;
      `);
      
      if (res.rows.length > 0) {
        const { db_user, is_superuser, bypass_rls, can_create_db, can_create_role, can_replicate } = res.rows[0];
        if (is_superuser || bypass_rls || can_create_db || can_create_role || can_replicate) {
          return {
            ok: false,
            error: `VIOLACIÓN DE INVARIANTE DE SEGURIDAD (C-02, H-01): El rol runtime '${db_user}' tiene privilegios excesivos (super=${is_superuser}, bypassrls=${bypass_rls}, createdb=${can_create_db}, createrole=${can_create_role}, replicate=${can_replicate}). Exigido rol unprivileged.`,
          };
        }
      }

      // H-01: Verificar que el rol runtime no sea el propietario de la base ni del esquema public
      const ownerRes = await client.query(`
        SELECT 
          (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()) AS db_owner,
          (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'public') AS schema_owner;
      `);

      if (ownerRes.rows.length > 0) {
        const { db_owner, schema_owner } = ownerRes.rows[0];
        const dbUser = res.rows[0]?.db_user;
        if (dbUser && (dbUser === db_owner || dbUser === schema_owner)) {
          return {
            ok: false,
            error: `VIOLACIÓN DE INVARIANTE DE SEGURIDAD (C-03, H-01): El rol runtime '${dbUser}' es propietario de la base de datos ('${db_owner}') o del esquema public ('${schema_owner}'). El propietario debe ser 'app_owner'.`,
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

