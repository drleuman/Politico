const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');

async function main() {
  const db = new PGlite();
  await db.exec(fs.readFileSync('db/0000_bootstrap_roles.sql', 'utf8'));

  await db.exec('SET ROLE app_owner;');
  const rawSchema = fs.readFileSync('db/migrations/0001_initial_schema.sql', 'utf8').replace(/CREATE EXTENSION IF NOT EXISTS\s+("?pgcrypto"?);?/gi, '-- pgcrypto');
  await db.exec(rawSchema);
  await db.exec('RESET ROLE;');

  await db.exec('ALTER DEFAULT PRIVILEGES FOR ROLE app_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;');
  await db.exec('ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;');

  await db.exec('SET ROLE app_owner;');
  await db.exec('ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;');
  await db.exec('CREATE FUNCTION public.test_h01_func() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;');
  
  const aclRes = await db.query("SELECT proname, proacl FROM pg_proc WHERE proname = 'test_h01_func';");
  console.log('proacl:', aclRes.rows[0]);

  await db.exec('RESET ROLE;');

  await db.exec('SET ROLE app_user;');
  try {
    await db.exec('SELECT test_h01_func();');
    console.log('H01 executed without error (NOT DENIED)');
  } catch (err) {
    console.log('H01 err:', err.message);
  }
}

main().catch(err => console.error(err));
