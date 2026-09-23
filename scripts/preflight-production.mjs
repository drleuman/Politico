import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import Redis from 'ioredis';
import { verifyEmailTransport } from '../dist/email/adapter.js';

const { Client } = pg;

function fail(message) {
  throw new Error(`PRODUCTION_PREFLIGHT_FAILED: ${message}`);
}

async function verifyMigrations(client) {
  const dir = path.resolve('db', 'migrations');
  const expected = fs.readdirSync(dir).filter((name) => name.endsWith('.sql') && !name.endsWith('_down.sql')).sort();
  const applied = await client.query('SELECT filename, checksum FROM schema_migrations ORDER BY filename');
  const byName = new Map(applied.rows.map((row) => [row.filename, row.checksum]));

  for (const filename of expected) {
    const checksum = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, filename))).digest('hex');
    if (byName.get(filename) !== checksum) fail(`checksum ausente o distinto para ${filename}`);
  }
}

async function main() {
  const runtime = new Client({ connectionString: process.env.DATABASE_URL });
  const worker = new Client({ connectionString: process.env.EMAIL_WORKER_DATABASE_URL });
  const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 5000 });

  try {
    await runtime.connect();
    const runtimeSecurity = await runtime.query(`
      SELECT current_user AS role_name, r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole,
             pg_get_userbyid(d.datdba) AS db_owner,
             pg_get_userbyid(n.nspowner) AS schema_owner,
             has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create
      FROM pg_roles r, pg_database d, pg_namespace n
      WHERE r.rolname = current_user AND d.datname = current_database() AND n.nspname = 'public'
    `);
    const rs = runtimeSecurity.rows[0];
    if (!rs || rs.role_name !== 'politica_canon_app' || rs.rolsuper || rs.rolbypassrls || rs.rolcreatedb || rs.rolcreaterole || rs.db_owner !== 'app_owner' || rs.schema_owner !== 'app_owner' || rs.schema_create) {
      fail('identidad o privilegios del rol runtime no cumplen el contrato');
    }
    await verifyMigrations(runtime);

    const catalog = await runtime.query(`
      SELECT
        to_regclass('public.email_outbox') IS NOT NULL AS has_outbox,
        (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity)
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN information_schema.columns cols
             ON cols.table_schema = n.nspname AND cols.table_name = c.relname
          WHERE n.nspname = 'public' AND c.relkind = 'r'
            AND cols.column_name = 'organization_id') AS rls_forced
    `);
    if (!catalog.rows[0]?.has_outbox || !catalog.rows[0]?.rls_forced) fail('outbox o FORCE RLS incompletos');

    await worker.connect();
    const workerSecurity = await worker.query(`
      SELECT current_user AS role_name, r.rolsuper, r.rolbypassrls,
             has_table_privilege(current_user, 'public.email_outbox', 'SELECT') AS can_select,
             has_table_privilege(current_user, 'public.email_outbox', 'UPDATE') AS can_update,
             has_table_privilege(current_user, 'public.email_outbox', 'INSERT') AS can_insert
      FROM pg_roles r WHERE r.rolname = current_user
    `);
    const ws = workerSecurity.rows[0];
    if (!ws || ws.role_name !== 'politica_canon_email_worker' || ws.rolsuper || ws.rolbypassrls || !ws.can_select || !ws.can_update || ws.can_insert) {
      fail('identidad o privilegios del worker no cumplen el contrato');
    }

    await redis.connect();
    if (await redis.ping() !== 'PONG') fail('Redis no respondió PONG');
    if (!(await verifyEmailTransport())) fail('SMTP no superó verify()');

    console.log('PRODUCTION_PREFLIGHT_PASS');
  } finally {
    await Promise.allSettled([runtime.end(), worker.end(), redis.quit()]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
