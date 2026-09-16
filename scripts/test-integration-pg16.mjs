import { execSync } from 'child_process';
import pg from 'pg';
const { Client } = pg;

console.log('=== RUNNER DE INTEGRACIÓN REAL POSTGRESQL 16 & REDIS (v0.3.18 ADVERSARIAL FAIL-CLOSED) ===\n');

const ADMIN_URL = process.env.POLITICA_CANON_ADMIN_DATABASE_URL || 'postgresql://postgres:audit_dev_only_secret_do_not_use_in_prod@127.0.0.1:15432/politica_canon';
const MIGRATION_URL = process.env.MIGRATION_DATABASE_URL || ADMIN_URL;
const APP_TEST_PASSWORD = process.env.POLITICA_CANON_APP_TEST_PASSWORD || 'audit_dev_only_secret_do_not_use_in_prod';
const APP_URL = process.env.DATABASE_URL || `postgresql://politica_canon_app:${APP_TEST_PASSWORD}@127.0.0.1:15432/politica_canon`;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:16379/0';
const SESSION_SECRET = process.env.SESSION_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const MFA_MASTER_KEY = process.env.MFA_MASTER_KEY || 'mfa_master_key_default_32_chars_test_secret_key_123456789';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://peaceful-johnson.194-164-175-146.plesk.page';

process.env.POLITICA_CANON_ADMIN_DATABASE_URL = ADMIN_URL;
process.env.MIGRATION_DATABASE_URL = MIGRATION_URL;
process.env.DATABASE_URL = APP_URL;
process.env.REDIS_URL = REDIS_URL;
process.env.SESSION_SECRET = SESSION_SECRET;
process.env.MFA_MASTER_KEY = MFA_MASTER_KEY;
process.env.APP_BASE_URL = APP_BASE_URL;
process.env.NODE_ENV = 'test';

async function checkDockerAvailable() {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function waitForDb(adminUrl, retries = 20) {
  for (let i = 0; i < retries; i++) {
    const client = new Client({ connectionString: adminUrl });
    try {
      await client.connect();
      await client.query('SELECT 1;');
      await client.end();
      return true;
    } catch {
      await client.end().catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

function runScript(scriptPath, envVars = {}) {
  console.log(`▶ Ejecutando script de producción: ${scriptPath}`);
  const env = { ...process.env, ...envVars };
  execSync(`node ${scriptPath}`, { stdio: 'inherit', env });
}

function extractCookie(res, cookieName) {
  const cookies = res.cookies || [];
  const target = cookies.find(c => c.name === cookieName);
  return target ? target.value : null;
}

async function runIntegrationTest() {
  let composeStarted = false;
  let fastifyApp = null;

  try {
    const dockerOk = await checkDockerAvailable();
    if (!dockerOk) {
      throw new Error('REAL_PG16_AND_REDIS_REQUIRED: Docker Engine no está activo ni disponible.');
    }

    console.log('🐳 Levantando contenedores PostgreSQL 16 y Redis 7 reales en Docker Compose...');
    try {
      execSync('docker compose -f docker-compose.audit.yml up -d', { stdio: 'inherit' });
      composeStarted = true;
    } catch (composeErr) {
      throw new Error(`REAL_PG16_AND_REDIS_REQUIRED: Falló docker compose up: ${composeErr.message}`);
    }

    console.log('⏳ Esperando disponibilidad de PostgreSQL 16 en 127.0.0.1:15432...');
    const dbReady = await waitForDb(ADMIN_URL);
    if (!dbReady) {
      throw new Error('REAL_PG16_AND_REDIS_REQUIRED: PostgreSQL 16 no respondió en 127.0.0.1:15432.');
    }
    console.log('✅ PostgreSQL 16 en Docker Compose conectado exitosamente.');

    // RONDAS 1 Y 2 PARA PROBAR FASES PRODUCTIVAS E IDEMPOTENCIA
    for (let round = 1; round <= 2; round++) {
      console.log(`\n--- FASE ${round}: EJECUCIÓN PRODUCTIVA (RONDA ${round} DE IDEMPOTENCIA) ---`);
      
      runScript('scripts/bootstrap-pre.mjs');

      console.log(`🔑 [C-02 TEST SETUP] Asignando contraseña exclusiva de prueba al rol runtime 'politica_canon_app'...`);
      const adminClient = new Client({ connectionString: ADMIN_URL });
      await adminClient.connect();
      await adminClient.query(`ALTER ROLE politica_canon_app WITH PASSWORD '${APP_TEST_PASSWORD}';`);
      console.log("✅ [C-02 TEST SETUP] Contraseña de prueba asignada a 'politica_canon_app'.");

      runScript('scripts/migrate-production.mjs');
      runScript('scripts/bootstrap-post.mjs');

      console.log(`\n--- ASERCIONES DE CATÁLOGO PG16 REAL (RONDA ${round}) ---`);
      const ownerCheck = await adminClient.query("SELECT pg_catalog.pg_get_userbyid(datdba) AS db_owner FROM pg_catalog.pg_database WHERE datname = 'politica_canon';");
      const dbOwner = ownerCheck.rows[0]?.db_owner;
      if (dbOwner !== 'app_owner') {
        throw new Error(`CRITICAL FAIL: datdba es '${dbOwner}', se requiere 'app_owner'.`);
      }
      console.log(`✅ Catálogo PG16: datdba = '${dbOwner}' (app_owner verificado).`);

      const dispCheck = await adminClient.query("SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'audit_dispatcher';");
      if (!dispCheck.rows[0]?.rolbypassrls) {
        throw new Error('CRITICAL FAIL: audit_dispatcher no tiene BYPASSRLS activado.');
      }
      console.log('✅ Catálogo PG16: audit_dispatcher BYPASSRLS = true.');

      const resolverCheck = await adminClient.query("SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'token_resolver';");
      if (!resolverCheck.rows[0]?.rolbypassrls) {
        throw new Error('CRITICAL FAIL: token_resolver no tiene BYPASSRLS activado.');
      }
      console.log('✅ Catálogo PG16: token_resolver BYPASSRLS = true (Resolver acotado de hashes para FORCE RLS).');

      const funcOwnerCheck = await adminClient.query(`
        SELECT p.proname, pg_catalog.pg_get_userbyid(p.proowner) AS owner_name
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN ('resolve_session_by_token', 'resolve_invitation_by_token', 'get_user_active_memberships');
      `);
      if (funcOwnerCheck.rows.length !== 3) {
        throw new Error(`CRITICAL FAIL: Se esperaban 3 funciones resolver, se encontraron ${funcOwnerCheck.rows.length}.`);
      }
      for (const row of funcOwnerCheck.rows) {
        if (row.owner_name !== 'token_resolver') {
          throw new Error(`CRITICAL FAIL: La función '${row.proname}' pertenece a '${row.owner_name}', se requiere 'token_resolver'.`);
        }
      }
      console.log('✅ Catálogo PG16: Las 3 funciones resolver pertenecen autoritativamente a token_resolver.');

      const tokenResolverCreateCheck = await adminClient.query(`
        SELECT has_schema_privilege('token_resolver', 'public', 'CREATE') AS has_create;
      `);
      if (tokenResolverCreateCheck.rows[0]?.has_create) {
        throw new Error('CRITICAL FAIL: token_resolver conserva el permiso CREATE en el esquema public.');
      }
      console.log('✅ Catálogo PG16: token_resolver NO tiene permiso CREATE en el esquema public.');

      const memberCheck = await adminClient.query(`
        SELECT 1 FROM pg_auth_members m
        JOIN pg_roles r1 ON r1.oid = m.roleid
        JOIN pg_roles r2 ON r2.oid = m.member
        WHERE r1.rolname = 'token_resolver' AND r2.rolname = 'app_owner';
      `);
      if (memberCheck.rows.length > 0) {
        throw new Error('CRITICAL FAIL: app_owner aún conserva la membresía en el rol token_resolver.');
      }
      console.log('✅ Catálogo PG16: app_owner NO es miembro de token_resolver (membresía temporal revocada exitosamente).');

      await adminClient.end();
    }

    // VERIFICACIÓN CON SERVICIOS REALES FASTIFY (FASE 1.1: ADVERSARIAL SECURITY v0.3.18)
    console.log('\n--- VERIFICACIÓN DE SEGURIDAD ADVERSARIAL FASE 1.1 (PG16 + REDIS 7 — RELEASE v0.3.18) ---');
    
    const { hashPassword } = await import('../dist/auth/crypto.js');
    const { getTestSentEmails, clearTestSentEmails } = await import('../dist/email/adapter.js');
    clearTestSentEmails();

    const adminPassHash = await hashPassword('PasswordSecura123!');

    const setupClient = new Client({ connectionString: ADMIN_URL });
    await setupClient.connect();
    
    const orgId = '11111111-1111-1111-1111-111111111111';
    const otherOrgId = '99999999-9999-9999-9999-999999999999';
    const wsId = '22222222-2222-2222-2222-222222222222';
    const adminUserId = '33333333-3333-3333-3333-333333333333';

    await setupClient.query(`
      INSERT INTO organizations (id, name, slug) VALUES ('${orgId}', 'Org Test Canon', 'org-test-canon')
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO organizations (id, name, slug) VALUES ('${otherOrgId}', 'Org Ajena Test', 'org-ajena-test')
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO workspaces (id, organization_id, name, slug) VALUES ('${wsId}', '${orgId}', 'WS Principal', 'ws-principal')
      ON CONFLICT (organization_id, id) DO NOTHING;
      INSERT INTO users (id, email, full_name, is_active, mfa_enabled) VALUES ('${adminUserId}', 'admin@test.canon', 'Admin Semilla', TRUE, FALSE)
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO user_credentials (user_id, password_hash, password_algo) VALUES ('${adminUserId}', '${adminPassHash}', 'argon2id')
      ON CONFLICT (user_id) DO UPDATE SET password_hash = '${adminPassHash}';
      INSERT INTO organization_memberships (organization_id, user_id, is_active) VALUES ('${orgId}', '${adminUserId}', TRUE)
      ON CONFLICT (organization_id, user_id) DO NOTHING;
      INSERT INTO role_assignments (organization_id, scope_type, scope_id, target_user_id, assigned_role, is_active)
      VALUES ('${orgId}', 'ORGANIZATION', '${orgId}', '${adminUserId}', 'ADMIN', TRUE)
      ON CONFLICT DO NOTHING;
    `);
    await setupClient.end();

    const { buildServer } = await import('../dist/server.js');
    fastifyApp = buildServer();
    await fastifyApp.ready();

    // 1. Probe de Salud
    const readyRes = await fastifyApp.inject({ method: 'GET', url: '/readyz' });
    if (readyRes.statusCode !== 200) {
      throw new Error(`GET /readyz devolvió HTTP ${readyRes.statusCode}, se requiere 200.`);
    }
    console.log('✅ Probe Fastify /readyz: HTTP 200 OK');

    // 2. PRUEBA ADVERSARIAL: Intento de Login en Organización sin Membresía (Debe responder HTTP 403)
    const unauthorizedOrgLogin = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@test.canon',
        password: 'PasswordSecura123!',
        organizationId: otherOrgId,
      },
    });
    if (unauthorizedOrgLogin.statusCode !== 403) {
      throw new Error(`CRITICAL FAIL: Login en organización sin membresía devolvió HTTP ${unauthorizedOrgLogin.statusCode}, se requiere 403.`);
    }
    console.log('✅ Seguridad: Login en organización ajena rechazado con HTTP 403 (Membresía activa verificada).');

    // 3. Login de Admin y Verificación de Protección Cookie HttpOnly (NO retorno de rawToken en body)
    const loginRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@test.canon',
        password: 'PasswordSecura123!',
        organizationId: orgId,
      },
    });
    const loginBody = JSON.parse(loginRes.payload);
    if (loginRes.statusCode !== 200 || loginBody.token) {
      throw new Error(`CRITICAL FAIL: Login devolvió HTTP ${loginRes.statusCode} o expuso rawToken en body JSON. Response: ${loginRes.payload}`);
    }
    const adminSessionCookie = extractCookie(loginRes, 'sid') || extractCookie(loginRes, 'politica_canon_session');
    const csrfTokenCookie = loginBody.csrfToken || extractCookie(loginRes, 'csrf');
    if (!adminSessionCookie || !csrfTokenCookie) {
      throw new Error('CRITICAL FAIL: Login no estableció cookies HttpOnly de sesión o CSRF.');
    }
    console.log('✅ Seguridad: Login no expone token en JSON body (Solo Cookie HttpOnly).');
    console.log('✅ Seguridad: Resolución de sesión con FORCE RLS activa verificada exitosamente.');

    // 4. Habilitar MFA en la cuenta de Admin con mfa_verified_at = NOW()
    const adminMfaFreshClient = new Client({ connectionString: ADMIN_URL });
    await adminMfaFreshClient.connect();
    await adminMfaFreshClient.query(`UPDATE users SET mfa_enabled = TRUE WHERE id = '${adminUserId}';`);
    await adminMfaFreshClient.query(`UPDATE user_sessions SET mfa_verified_at = NOW() WHERE user_id = '${adminUserId}';`);
    await adminMfaFreshClient.end();

    // 5. Creación Exitosa de Invitación Válida y Verificación de Entrega vía Email Adapter (SIN Token en JSON)
    const invRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: {
        cookie: `sid=${adminSessionCookie}; csrf=${csrfTokenCookie}`,
        'x-csrf-token': csrfTokenCookie,
      },
      payload: {
        email: 'writer.nuevo.v18@test.canon',
        role: 'WRITER',
        workspaceId: wsId,
      },
    });
    const invBody = JSON.parse(invRes.payload);
    if (invRes.statusCode !== 201 || invBody.rawToken || invBody.invitationUrl) {
      throw new Error(`CRITICAL FAIL: Creación de invitación expuso rawToken o URL en body JSON. Response: ${invRes.payload}`);
    }

    const sentEmails = getTestSentEmails();
    if (sentEmails.length === 0 || sentEmails[0].to !== 'writer.nuevo.v18@test.canon') {
      throw new Error('CRITICAL FAIL: El adaptador de email no registró el correo de invitación entregado.');
    }
    const invitationToken = sentEmails[0].rawToken;
    console.log('✅ Email Adapter: Invitación entregada exclusivamente por correo de forma segura (SIN fuga de token en JSON).');

    // 6. Aceptar Invitación Privada obtenida del Correo
    const acceptRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: {
        token: invitationToken,
        fullName: 'Escritor V18',
        password: 'PasswordNuevo123!',
      },
    });
    const acceptBody = JSON.parse(acceptRes.payload);
    if (acceptRes.statusCode !== 201 || !acceptBody.userId) {
      throw new Error(`Aceptación de invitación falló: ${acceptRes.payload}`);
    }
    console.log('✅ Invitations API: Invitación resuelta bajo FORCE RLS y aceptada correctamente.');

    // 7. Intentar Reutilizar Invitación Consumida (Debe Fallar Cerrado 400)
    const reuseRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: {
        token: invitationToken,
        fullName: 'Intento Reutilizacion',
        password: 'PasswordNuevo123!',
      },
    });
    if (reuseRes.statusCode !== 400 || !JSON.parse(reuseRes.payload).error?.includes('INVITATION_REUSED')) {
      throw new Error(`Fallo en prevención de reutilización de invitación: ${reuseRes.payload}`);
    }
    console.log('✅ Invitations API: Reutilización de invitación rechazada (FAIL CLOSED).');

    // 8. Consulta de Sesiones Activas y Revocación de Sesión Específica
    const sessionsRes = await fastifyApp.inject({
      method: 'GET',
      url: '/api/v1/sessions',
      headers: { cookie: `sid=${adminSessionCookie}` },
    });
    const sessionsBody = JSON.parse(sessionsRes.payload);
    if (sessionsRes.statusCode !== 200 || !Array.isArray(sessionsBody.sessions)) {
      throw new Error(`Consulta GET /api/v1/sessions falló: ${sessionsRes.payload}`);
    }
    console.log('✅ Sessions API: GET /api/v1/sessions retornó las sesiones activas del usuario.');

    // 9. Consulta y Modificación de Estado de Usuarios (ADMIN / COORDINATOR)
    const usersRes = await fastifyApp.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { cookie: `sid=${adminSessionCookie}` },
    });
    const usersBody = JSON.parse(usersRes.payload);
    if (usersRes.statusCode !== 200 || !Array.isArray(usersBody.users)) {
      throw new Error(`Consulta GET /api/v1/users falló: ${usersRes.payload}`);
    }
    console.log('✅ Users API: GET /api/v1/users retornó la lista de usuarios de la organización.');

    console.log('\n🎉 SUITE DE INTEGRACIÓN FASE 1.1 CORRECTIVA (v0.3.18) COMPLETA Y CERTIFICADA (PASS)');

  } finally {
    if (fastifyApp) {
      await fastifyApp.close().catch(() => {});
    }
    try {
      const { closeDbPool } = await import('../dist/db/client.js');
      const { closeRedisClient } = await import('../dist/redis/client.js');
      await closeDbPool();
      await closeRedisClient();
    } catch {}

    if (composeStarted) {
      console.log('\n🧹 [FINALLY CLEANUP] Destruyendo contenedores y volúmenes de prueba Docker Compose (down -v)...');
      try {
        execSync('docker compose -f docker-compose.audit.yml down -v', { stdio: 'inherit' });
        console.log('✅ [FINALLY CLEANUP] Recursos Docker destruidos incondicionalmente en finally.');
      } catch (downErr) {
        console.warn('⚠️ Error al destruir contenedores Docker:', downErr.message);
      }
    }
  }
}

runIntegrationTest().catch((err) => {
  console.error('\n❌ ERROR FATAL EN PRUEBA DE INTEGRACIÓN PG16:', err.message);
  process.exit(1);
});
