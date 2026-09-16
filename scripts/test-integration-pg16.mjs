import { execSync } from 'child_process';
import pg from 'pg';
const { Client } = pg;

console.log('=== RUNNER DE INTEGRACIÓN REAL POSTGRESQL 16 & REDIS (v0.3.12 STRICT FAIL-CLOSED) ===\n');

const ADMIN_URL = process.env.POLITICA_CANON_ADMIN_DATABASE_URL || 'postgresql://postgres:audit_dev_only_secret_do_not_use_in_prod@127.0.0.1:15432/politica_canon';
const MIGRATION_URL = process.env.MIGRATION_DATABASE_URL || ADMIN_URL;
const APP_TEST_PASSWORD = process.env.POLITICA_CANON_APP_TEST_PASSWORD || 'audit_dev_only_secret_do_not_use_in_prod';
const APP_URL = process.env.DATABASE_URL || `postgresql://politica_canon_app:${APP_TEST_PASSWORD}@127.0.0.1:15432/politica_canon`;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:16379/0';
const SESSION_SECRET = process.env.SESSION_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://peaceful-johnson.194-164-175-146.plesk.page';

process.env.POLITICA_CANON_ADMIN_DATABASE_URL = ADMIN_URL;
process.env.MIGRATION_DATABASE_URL = MIGRATION_URL;
process.env.DATABASE_URL = APP_URL;
process.env.REDIS_URL = REDIS_URL;
process.env.SESSION_SECRET = SESSION_SECRET;
process.env.APP_BASE_URL = APP_BASE_URL;

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

      await adminClient.end();
    }

    // VERIFICACIÓN CON SERVICIOS REALES FASTIFY (FASE 1.1: INVITACIONES, USUARIOS, SESIONES Y MFA)
    console.log('\n--- VERIFICACIÓN DE FASE 1.1 CON CONEXIONES REALES (PG16 + REDIS 7) ---');
    
    // Crear Organización y Admin de Prueba directamente en la base de datos como bootstrap
    const { hashPassword } = await import('../dist/auth/crypto.js');
    const adminPassHash = await hashPassword('PasswordSecura123!');

    const setupClient = new Client({ connectionString: ADMIN_URL });
    await setupClient.connect();
    
    const orgId = '11111111-1111-1111-1111-111111111111';
    const wsId = '22222222-2222-2222-2222-222222222222';
    const adminUserId = '33333333-3333-3333-3333-333333333333';

    await setupClient.query(`
      INSERT INTO organizations (id, name, slug) VALUES ('${orgId}', 'Org Test Canon', 'org-test-canon')
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

    // 2. Login con Usuario Admin de Prueba
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
    if (loginRes.statusCode !== 200 || !loginBody.token) {
      throw new Error(`Login de admin falló: ${loginRes.payload}`);
    }
    const adminToken = loginBody.token;
    console.log('✅ Auth API: Login de Admin exitoso con credenciales Argon2id y sesión persistida.');

    // 3. Crear Invitación Privada
    const invRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: 'writer.nuevo@test.canon',
        role: 'WRITER',
        workspaceId: wsId,
      },
    });
    const invBody = JSON.parse(invRes.payload);
    if (invRes.statusCode !== 201 || !invBody.rawToken) {
      throw new Error(`Creación de invitación falló: ${invRes.payload}`);
    }
    const invitationToken = invBody.rawToken;
    console.log('✅ Invitations API: Invitación privada creada con token de alta entropía.');

    // 4. Aceptar Invitación Privada y Crear Cuenta de Usuario
    const acceptRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: {
        token: invitationToken,
        fullName: 'Escritor Nuevo',
        password: 'PasswordNuevo123!',
      },
    });
    const acceptBody = JSON.parse(acceptRes.payload);
    if (acceptRes.statusCode !== 201 || !acceptBody.userId) {
      throw new Error(`Aceptación de invitación falló: ${acceptRes.payload}`);
    }
    console.log('✅ Invitations API: Invitación aceptada correctamente y usuario registrado.');

    // 5. Intentar Reutilizar Invitación Consumida (Debe Fallar Cerrado)
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

    // 6. Login de Nuevo Usuario Escritor
    const writerLoginRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'writer.nuevo@test.canon',
        password: 'PasswordNuevo123!',
        organizationId: orgId,
      },
    });
    const writerLoginBody = JSON.parse(writerLoginRes.payload);
    if (writerLoginRes.statusCode !== 200 || !writerLoginBody.token) {
      throw new Error(`Login de nuevo escritor falló: ${writerLoginRes.payload}`);
    }
    const writerToken = writerLoginBody.token;
    console.log('✅ Auth API: Login del nuevo usuario con sesión rotada.');

    // 7. Enrolamiento TOTP MFA
    const mfaSetupRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup',
      headers: { authorization: `Bearer ${writerToken}` },
    });
    const mfaSetupBody = JSON.parse(mfaSetupRes.payload);
    if (mfaSetupRes.statusCode !== 200 || !mfaSetupBody.secret) {
      throw new Error(`MFA setup falló: ${mfaSetupRes.payload}`);
    }

    const { generateTotpCode } = await import('../dist/auth/crypto.js');
    const firstCode = generateTotpCode(mfaSetupBody.secret);

    const mfaConfirmRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/confirm',
      headers: { authorization: `Bearer ${writerToken}` },
      payload: { code: firstCode },
    });
    const mfaConfirmBody = JSON.parse(mfaConfirmRes.payload);
    if (mfaConfirmRes.statusCode !== 200 || !mfaConfirmBody.backupCodes || mfaConfirmBody.backupCodes.length !== 10) {
      throw new Error(`MFA confirm falló: ${mfaConfirmRes.payload}`);
    }
    console.log('✅ MFA API: TOTP enrolado exitosamente y 10 códigos de respaldo generados.');

    // 8. Consulta /api/v1/auth/me y Verificación del Contexto de Autorización
    const meRes = await fastifyApp.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${writerToken}` },
    });
    const meBody = JSON.parse(meRes.payload);
    if (meRes.statusCode !== 200 || meBody.user.email !== 'writer.nuevo@test.canon') {
      throw new Error(`GET /api/v1/auth/me falló: ${meRes.payload}`);
    }
    console.log('✅ Auth API: GET /api/v1/auth/me retornó el perfil y contexto resuelto.');

    // 9. Cierre de Sesión (Logout)
    const logoutRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${writerToken}` },
    });
    if (logoutRes.statusCode !== 200) {
      throw new Error(`Logout falló: ${logoutRes.payload}`);
    }

    // Verificar que la sesión revocada no sea accesible
    const meRevokedRes = await fastifyApp.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${writerToken}` },
    });
    if (meRevokedRes.statusCode !== 401) {
      throw new Error(`Sesión revocada siguió siendo aceptada: ${meRevokedRes.payload}`);
    }
    console.log('✅ Auth API: Logout revocó la sesión correctamente en PostgreSQL.');

    console.log('\n🎉 SUITE DE INTEGRACIÓN FASE 1.1 COMPLETA Y CERTIFICADA (PASS)');

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
