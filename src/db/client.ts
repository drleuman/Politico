import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

export const dbPool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const emailWorkerPool = new Pool({
  connectionString: config.emailWorkerDatabaseUrl,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function checkEmailWorkerSecurity(pool: pg.Pool): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT 
          current_user AS db_user, 
          rolsuper AS is_superuser, 
          rolbypassrls AS bypass_rls,
          rolcreatedb AS can_create_db,
          rolcreaterole AS can_create_role,
          has_table_privilege(current_user, 'public.email_outbox', 'SELECT') AS can_select,
          has_table_privilege(current_user, 'public.email_outbox', 'UPDATE') AS can_update,
          has_table_privilege(current_user, 'public.email_outbox', 'INSERT') AS can_insert
        FROM pg_roles 
        WHERE rolname = current_user;
      `);

      if (res.rows.length === 0) {
        return { ok: false, error: 'NO_ROLE_FOUND: No se pudo verificar el rol de base de datos del worker.' };
      }

      const { db_user, is_superuser, bypass_rls, can_create_db, can_create_role, can_select, can_update, can_insert } = res.rows[0];

      if (db_user !== 'politica_canon_email_worker') {
        return {
          ok: false,
          error: `VIOLACIÓN DE AISLAMIENTO WORKER (C-01, C-03): El proceso worker está conectado como '${db_user}', se requiere estrictamente 'politica_canon_email_worker'.`,
        };
      }

      if (is_superuser || bypass_rls || can_create_db || can_create_role) {
        return {
          ok: false,
          error: `VIOLACIÓN DE MÍNIMOS PRIVILEGIOS WORKER (C-01): El rol worker '${db_user}' tiene privilegios excesivos (super=${is_superuser}, bypassrls=${bypass_rls}).`,
        };
      }

      if (!can_select || !can_update || can_insert) {
        return {
          ok: false,
          error: `VIOLACIÓN DE PRIVILEGIOS DML WORKER (H-04): El rol worker '${db_user}' tiene privilegios inválidos en email_outbox (select=${can_select}, update=${can_update}, insert=${can_insert}). Exigido select=true, update=true, insert=false.`,
        };
      }

      return { ok: true };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Worker database security check failed' };
  }
}

export async function checkDatabaseHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await dbPool.connect();
    try {
      const res = await client.query(`
        SELECT 
          current_user AS db_user, 
          rolsuper AS is_superuser, 
          rolbypassrls AS bypass_rls,
          rolcreatedb AS can_create_db,
          rolcreaterole AS can_create_role,
          rolreplication AS can_replicate
        FROM pg_roles 
        WHERE rolname = current_user;
      `);
      
      if (res.rows.length > 0) {
        const { db_user, is_superuser, bypass_rls, can_create_db, can_create_role, can_replicate } = res.rows[0];
        if (is_superuser || bypass_rls || can_create_db || can_create_role || can_replicate) {
          return {
            ok: false,
            error: `VIOLACIÓN DE INVARIANTE DE SEGURIDAD (C-02, H-01, H-03): El rol runtime '${db_user}' tiene privilegios excesivos (super=${is_superuser}, bypassrls=${bypass_rls}, createdb=${can_create_db}, createrole=${can_create_role}, replicate=${can_replicate}). Exigido rol unprivileged.`,
          };
        }
      }

      // H-03: Verificar que la base de datos y el esquema public sean propiedad exacta de app_owner y que el runtime no tenga privilegios CREATE
      const ownerRes = await client.query(`
        SELECT 
          (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()) AS db_owner,
          (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'public') AS schema_owner,
          has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema,
          has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_database;
      `);

      if (ownerRes.rows.length > 0) {
        const { db_owner, schema_owner, can_create_schema, can_create_database } = ownerRes.rows[0];
        const dbUser = res.rows[0]?.db_user;

        if (db_owner !== 'app_owner' || schema_owner !== 'app_owner') {
          return {
            ok: false,
            error: `VIOLACIÓN DE INVARIANTE DE SEGURIDAD (C-03, H-03): Propietario invalido de base de datos ('${db_owner}') o esquema public ('${schema_owner}'). El propietario debe ser estrictamente 'app_owner'.`,
          };
        }

        if (can_create_schema || can_create_database) {
          return {
            ok: false,
            error: `VIOLACIÓN DE INVARIANTE DE SEGURIDAD (C-03, H-03): El rol runtime '${dbUser}' conserva privilegios CREATE en el esquema public (${can_create_schema}) o en la base de datos (${can_create_database}).`,
          };
        }

        if (dbUser && (dbUser === db_owner || dbUser === schema_owner)) {
          return {
            ok: false,
            error: `VIOLACIÓN DE INVARIANTE DE SEGURIDAD (C-03, H-03): El rol runtime '${dbUser}' coincide con el propietario de la base o esquema public. Exigido aislamiento.`,
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
    await Promise.all([
      dbPool.end().catch(() => {}),
      emailWorkerPool.end().catch(() => {}),
    ]);
  } catch (err: any) {
    console.error('Error cerrando pool de base de datos:', err.message);
  }
}
