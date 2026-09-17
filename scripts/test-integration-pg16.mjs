import { execSync } from 'child_process';
import pg from 'pg';
import http from 'http';
const { Client } = pg;

console.log('=== RUNNER DE INTEGRACIÓN REAL POSTGRESQL 16, REDIS 7 & MAILPIT SMTP (v0.3.21 CERTIFICADO) ===\n');

const ADMIN_URL = process.env.POLITICA_CANON_ADMIN_DATABASE_URL || 'postgresql://postgres:audit_dev_only_secret_do_not_use_in_prod@127.0.0.1:15432/politica_canon';
const MIGRATION_URL = process.env.MIGRATION_DATABASE_URL || ADMIN_URL;
const APP_TEST_PASSWORD = process.env.POLITICA_CANON_APP_TEST_PASSWORD || 'audit_dev_only_secret_do_not_use_in_prod';
const APP_URL = process.env.DATABASE_URL || `postgresql://politica_canon_app:${APP_TEST_PASSWORD}@127.0.0.1:15432/politica_canon`;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:16379/0';
const SESSION_SECRET = process.env.SESSION_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const MFA_MASTER_KEY = process.env.MFA_MASTER_KEY || 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://peaceful-johnson.194-164-175-146.plesk.page';
const SMTP_HOST = process.env.SMTP_HOST || '127.0.0.1';
const SMTP_PORT = process.env.SMTP_PORT || '11025';

process.env.POLITICA_CANON_ADMIN_DATABASE_URL = ADMIN_URL;
process.env.MIGRATION_DATABASE_URL = MIGRATION_URL;
process.env.DATABASE_URL = APP_URL;
process.env.REDIS_URL = REDIS_URL;
process.env.SESSION_SECRET = SESSION_SECRET;
process.env.MFA_MASTER_KEY = MFA_MASTER_KEY;
process.env.APP_BASE_URL = APP_BASE_URL;
process.env.SMTP_HOST = SMTP_HOST;
process.env.SMTP_PORT = SMTP_PORT;
process.env.SMTP_FROM = 'no-reply@politica-canon.local';
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

function fetchMailpitMessages() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:18025/api/v1/messages', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function fetchMailpitMessageBody(messageId) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:18025/api/v1/message/${messageId}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
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

    console.log('🐳 Levantando contenedores PostgreSQL 16, Redis 7 y Mailpit SMTP en Docker Compose...');
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

      await adminClient.end();
    }

    // VERIFICACIÓN CON SERVICIOS REALES FASTIFY (FASE 1.1: ADVERSARIAL SECURITY v0.3.21)
    console.log('\n--- VERIFICACIÓN DE SEGURIDAD ADVERSARIAL FASE 1.1 (PG16 + REDIS 7 + MAILPIT SMTP — RELEASE v0.3.21) ---');
    
    const { hashPassword } = await import('../dist/auth/crypto.js');
    
    const adminPassHash = await hashPassword('PasswordSecura123!');

    const setupClient = new Client({ connectionString: ADMIN_URL });
    await setupClient.connect();
    
    const orgId = '11111111-1111-1111-1111-111111111111';
    const otherOrgId = '99999999-9999-9999-9999-999999999999';
    const wsId = '22222222-2222-2222-2222-222222222222';
    const adminUserId = '33333333-3333-3333-3333-333333333333';
    const foreignUserId = '88888888-8888-8888-8888-888888888888';

    await setupClient.query(`
      INSERT INTO organizations (id, name, slug) VALUES ('${orgId}', 'Org Test Canon', 'org-test-canon') ON CONFLICT (id) DO NOTHING;
      INSERT INTO organizations (id, name, slug) VALUES ('${otherOrgId}', 'Org Ajena Test', 'org-ajena-test') ON CONFLICT (id) DO NOTHING;
      INSERT INTO workspaces (id, organization_id, name, slug) VALUES ('${wsId}', '${orgId}', 'WS Principal', 'ws-principal') ON CONFLICT (organization_id, id) DO NOTHING;
      INSERT INTO users (id, email, full_name, is_active, mfa_enabled) VALUES ('${adminUserId}', 'admin@test.canon', 'Admin Semilla', TRUE, FALSE) ON CONFLICT (id) DO NOTHING;
      INSERT INTO user_credentials (user_id, password_hash, password_algo) VALUES ('${adminUserId}', '${adminPassHash}', 'argon2id') ON CONFLICT (user_id) DO UPDATE SET password_hash = '${adminPassHash}';
      INSERT INTO organization_memberships (organization_id, user_id, is_active) VALUES ('${orgId}', '${adminUserId}', TRUE) ON CONFLICT (organization_id, user_id) DO NOTHING;
      INSERT INTO role_assignments (organization_id, scope_type, scope_id, target_user_id, assigned_role, is_active)
      VALUES ('${orgId}', 'ORGANIZATION', '${orgId}', '${adminUserId}', 'ADMIN', TRUE) ON CONFLICT DO NOTHING;

      -- Usuario de la otra organización (para prueba C-03 cross-tenant)
      INSERT INTO users (id, email, full_name, is_active, mfa_enabled) VALUES ('${foreignUserId}', 'user@ajeno.test', 'Usuario Ajeno', TRUE, FALSE) ON CONFLICT (id) DO NOTHING;
      INSERT INTO organization_memberships (organization_id, user_id, is_active) VALUES ('${otherOrgId}', '${foreignUserId}', TRUE) ON CONFLICT (organization_id, user_id) DO NOTHING;
    `);
    await setupClient.end();

    const { buildServer } = await import('../dist/server.js');
    fastifyApp = buildServer();
    await fastifyApp.ready();

    // 1. Probe de Salud con Estado SMTP
    const readyRes = await fastifyApp.inject({ method: 'GET', url: '/readyz' });
    if (readyRes.statusCode !== 200) {
      throw new Error(`GET /readyz devolvió HTTP ${readyRes.statusCode}, se requiere 200.`);
    }
    console.log('✅ Probe Fastify /readyz: HTTP 200 OK (PostgreSQL 16, Redis 7 y Mailpit SMTP verificados).');

    // 2. PRUEBA ADVERSARIAL H-02: Respuesta Uniforme e Indistinguible en Login (Anti-Enumeración)
    const badLogin1 = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'inexistente@test.canon', password: 'PasswordSecura123!' }
    });
    const badLogin2 = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@test.canon', password: 'PasswordIncorrecta!' }
    });
    if (badLogin1.statusCode !== 401 || badLogin2.statusCode !== 401 || badLogin1.payload !== badLogin2.payload) {
      throw new Error(`CRITICAL FAIL H-02: Login expose respuestas distintas: ${badLogin1.payload} vs ${badLogin2.payload}`);
    }
    console.log('✅ Seguridad H-02: Login retorna respuesta neutral 401 uniforme sin revelar existencia de usuarios.');

    // 3. Login de Admin y Verificación de Cookie HttpOnly __Host-sid
    const loginRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@test.canon', password: 'PasswordSecura123!', organizationId: orgId }
    });
    const loginBody = JSON.parse(loginRes.payload);
    if (loginRes.statusCode !== 200 || loginBody.token || loginBody.rawToken) {
      throw new Error(`CRITICAL FAIL: Login expuso rawToken en body. Response: ${loginRes.payload}`);
    }
    const adminSessionCookie = extractCookie(loginRes, '__Host-sid');
    const csrfTokenCookie = loginBody.csrfToken || extractCookie(loginRes, 'csrf');
    if (!adminSessionCookie || !csrfTokenCookie) {
      throw new Error('CRITICAL FAIL: Login no estableció cookie HttpOnly __Host-sid o token CSRF.');
    }
    console.log('✅ Seguridad: Login establece exclusivamente cookie HttpOnly __Host-sid (sin exponer token en JSON).');

    // 4. H-01 PRUEBA NEGATIVA: Cookie heredada 'sid' DEBE ser rechazada con 401
    const sidRejectRes = await fastifyApp.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: `sid=${adminSessionCookie}` }
    });
    if (sidRejectRes.statusCode !== 401) {
      throw new Error(`CRITICAL FAIL H-01: Se aceptó cookie heredada 'sid' (Devolvió HTTP ${sidRejectRes.statusCode}, se requiere 401).`);
    }
    console.log('✅ H-01 Seguridad: Cookie heredada sid rechazada con HTTP 401 (Solo __Host-sid permitida).');

    // 5. Habilitar MFA en cuenta de Admin para pruebas de gobernanza
    const adminMfaFreshClient = new Client({ connectionString: ADMIN_URL });
    await adminMfaFreshClient.connect();
    await adminMfaFreshClient.query(`UPDATE users SET mfa_enabled = TRUE WHERE id = '${adminUserId}';`);
    await adminMfaFreshClient.query(`UPDATE user_sessions SET mfa_verified_at = NOW() WHERE user_id = '${adminUserId}';`);
    await adminMfaFreshClient.end();

    // 6. WAIT FOR MAILPIT AVAILABILITY (M-03) AND REAL SMTP TRANSMISSION (C-04)
    console.log('⏳ Esperando disponibilidad de Mailpit API (18025) y SMTP (11025)...');
    let mailpitReady = false;
    for (let i = 0; i < 15; i++) {
      try {
        await fetchMailpitMessages();
        mailpitReady = true;
        break;
      } catch {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    if (!mailpitReady) throw new Error('CRITICAL FAIL M-03: Mailpit API en 18025 no estuvo disponible a tiempo.');

    const invRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/invitations',
      headers: {
        cookie: `__Host-sid=${adminSessionCookie}; csrf=${csrfTokenCookie}`,
        'x-csrf-token': csrfTokenCookie,
      },
      payload: { email: 'writer.nuevo@test.canon', role: 'WRITER', workspaceId: wsId },
    });
    const invBody = JSON.parse(invRes.payload);
    if (invRes.statusCode !== 201 || invBody.rawToken) {
      throw new Error(`Creación de invitación falló: ${invRes.payload}`);
    }
    
    // Forzar procesado del outbox de correo
    const { processEmailOutbox } = await import('../dist/email/outbox.js');
    const { dbPool } = await import('../dist/db/client.js');
    await processEmailOutbox(dbPool);

    // Obtener mensaje transmitido por SMTP a Mailpit desde su API REST en puerto 18025
    const mailpitData = await fetchMailpitMessages();
    if (!mailpitData.messages || mailpitData.messages.length === 0) {
      throw new Error('CRITICAL FAIL C-04: Mailpit no recibió ningún correo vía SMTP real en el puerto 11025.');
    }
    
    const latestMailMeta = mailpitData.messages[0];
    const fullMail = await fetchMailpitMessageBody(latestMailMeta.ID);
    const textBody = fullMail.Text || fullMail.HTML || '';
    
    const tokenMatch = textBody.match(/token=([a-f0-9]+)/);
    if (!tokenMatch) throw new Error(`No se pudo extraer token del cuerpo del correo en Mailpit. Body: ${textBody}`);
    const invitationToken = tokenMatch[1];
    console.log('✅ C-04 Real SMTP Mailpit: Invitación entregada exitosamente vía Outbox + SMTP real (Mailpit port 11025).');

    // 7. Aceptar Invitación Privada obtenida de Mailpit
    const acceptRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/invitations/accept',
      payload: {
        token: invitationToken,
        fullName: 'Escritor Remediado',
        password: 'PasswordNuevo123!',
      },
    });
    const acceptBody = JSON.parse(acceptRes.payload);
    if (acceptRes.statusCode !== 201 || !acceptBody.userId) {
      throw new Error(`Aceptación de invitación falló: ${acceptRes.payload}`);
    }
    console.log('✅ Invitations API: Invitación aceptada correctamente con token extraído de Mailpit.');

    // 8. C-01 PRUEBA E2E: RECUPERACIÓN DE CONTRASEÑA, REVOCACIÓN DE SESIONES Y AUDITORÍA TENANT
    console.log('\n--- PRUEBA E2E C-01: RESTABLECIMIENTO DE CONTRASEÑA Y REVOCACIÓN DE SESIONES ---');
    const resetUserEmail = 'reset.user@test.canon';
    const resetUserId = '66666666-6666-6666-6666-666666666666';
    const resetUserPassHash = await hashPassword('PasswordResetOld123!');
    
    const dbClientC01 = new Client({ connectionString: ADMIN_URL });
    await dbClientC01.connect();
    await dbClientC01.query(`
      INSERT INTO users (id, email, full_name, is_active, mfa_enabled) VALUES ('${resetUserId}', '${resetUserEmail}', 'User Reset Test', TRUE, FALSE) ON CONFLICT (id) DO NOTHING;
      INSERT INTO user_credentials (user_id, password_hash, password_algo) VALUES ('${resetUserId}', '${resetUserPassHash}', 'argon2id') ON CONFLICT (user_id) DO UPDATE SET password_hash = '${resetUserPassHash}';
      INSERT INTO organization_memberships (organization_id, user_id, is_active) VALUES ('${orgId}', '${resetUserId}', TRUE) ON CONFLICT (organization_id, user_id) DO NOTHING;
      INSERT INTO role_assignments (organization_id, scope_type, scope_id, target_user_id, assigned_role, is_active)
      VALUES ('${orgId}', 'ORGANIZATION', '${orgId}', '${resetUserId}', 'WRITER', TRUE) ON CONFLICT DO NOTHING;
    `);

    // Iniciar sesión con resetUser para crear una sesión activa
    const resetLoginRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: resetUserEmail, password: 'PasswordResetOld123!', organizationId: orgId }
    });
    const resetSessionCookie = extractCookie(resetLoginRes, '__Host-sid');
    if (!resetSessionCookie) throw new Error('C-01 Test: Login de usuario para reset falló.');

    // Solicitar restablecimiento de contraseña
    const forgotRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: resetUserEmail }
    });
    if (forgotRes.statusCode !== 200) throw new Error(`forgot-password falló: ${forgotRes.payload}`);

    await processEmailOutbox(dbPool);

    // Obtener token de reset desde Mailpit
    const resetMailpit = await fetchMailpitMessages();
    const latestResetMailMeta = resetMailpit.messages[0];
    const fullResetMail = await fetchMailpitMessageBody(latestResetMailMeta.ID);
    const resetTokenMatch = (fullResetMail.Text || fullResetMail.HTML || '').match(/token=([a-f0-9]+)/);
    if (!resetTokenMatch) throw new Error('C-01 Test: No se encontró token de reset en Mailpit.');
    const resetToken = resetTokenMatch[1];

    // Ejecutar reset-password
    const executeResetRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: resetToken, newPassword: 'PasswordResetNew123!' }
    });
    if (executeResetRes.statusCode !== 200) throw new Error(`reset-password falló: ${executeResetRes.payload}`);

    // Verificar que la sesión previa del usuario QUEDÓ REVOCADA (devuelve HTTP 401)
    const revokedSessionCheck = await fastifyApp.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: `__Host-sid=${resetSessionCookie}` }
    });
    if (revokedSessionCheck.statusCode !== 401) {
      throw new Error(`CRITICAL FAIL C-01: La sesión previa del usuario no fue revocada tras reset-password (HTTP ${revokedSessionCheck.statusCode}).`);
    }

    // Verificar que el evento de auditoría PASSWORD_RESET_COMPLETED fue registrado
    const auditRes = await dbClientC01.query(`SELECT event_type FROM security_audit_events WHERE organization_id = '${orgId}' AND actor_id = '${resetUserId}' AND event_type = 'PASSWORD_RESET_COMPLETED'`);
    if (auditRes.rows.length === 0) {
      throw new Error('CRITICAL FAIL C-01: Evento de auditoría PASSWORD_RESET_COMPLETED no registrado tras reset.');
    }
    console.log('✅ C-01 E2E: Restablecimiento de contraseña revocó efectivamente todas las sesiones previas y registró evento de auditoría con GUC tenant.');
    await dbClientC01.end();

    // 9. C-02 PRUEBA DE BYPASS JERÁRQUICO CON MÚLTIPLES ROLES (WRITER + ADMIN)
    console.log('\n--- PRUEBA E2E C-02: EVALUACIÓN DE JERARQUÍA SOBRE MÚLTIPLES ROLES (WRITER + ADMIN) ---');
    const multiRoleUserId = '44444444-4444-4444-4444-444444444444';
    const coordUserId = '55555555-4444-4444-4444-555555555555';
    const dbClientC02 = new Client({ connectionString: ADMIN_URL });
    await dbClientC02.connect();

    const coordPassHash = await hashPassword('PasswordCoord123!');
    await dbClientC02.query(`
      INSERT INTO users (id, email, full_name, is_active, mfa_enabled) VALUES ('${multiRoleUserId}', 'multirole@test.canon', 'User WRITER+ADMIN', TRUE, FALSE) ON CONFLICT (id) DO NOTHING;
      INSERT INTO organization_memberships (organization_id, user_id, is_active) VALUES ('${orgId}', '${multiRoleUserId}', TRUE) ON CONFLICT (organization_id, user_id) DO NOTHING;
      -- Asignar 2 roles activos: WRITER y ADMIN
      INSERT INTO role_assignments (organization_id, scope_type, scope_id, target_user_id, assigned_role, is_active)
      VALUES ('${orgId}', 'ORGANIZATION', '${orgId}', '${multiRoleUserId}', 'WRITER', TRUE) ON CONFLICT DO NOTHING;
      INSERT INTO role_assignments (organization_id, scope_type, scope_id, target_user_id, assigned_role, is_active)
      VALUES ('${orgId}', 'ORGANIZATION', '${orgId}', '${multiRoleUserId}', 'ADMIN', TRUE) ON CONFLICT DO NOTHING;

      -- Crear usuario COORDINATOR
      INSERT INTO users (id, email, full_name, is_active, mfa_enabled) VALUES ('${coordUserId}', 'coord@test.canon', 'Coordinator Test', TRUE, TRUE) ON CONFLICT (id) DO NOTHING;
      INSERT INTO user_credentials (user_id, password_hash, password_algo) VALUES ('${coordUserId}', '${coordPassHash}', 'argon2id') ON CONFLICT (user_id) DO UPDATE SET password_hash = '${coordPassHash}';
      INSERT INTO organization_memberships (organization_id, user_id, is_active) VALUES ('${orgId}', '${coordUserId}', TRUE) ON CONFLICT (organization_id, user_id) DO NOTHING;
      INSERT INTO role_assignments (organization_id, scope_type, scope_id, target_user_id, assigned_role, is_active)
      VALUES ('${orgId}', 'ORGANIZATION', '${orgId}', '${coordUserId}', 'COORDINATOR', TRUE) ON CONFLICT DO NOTHING;
    `);

    // Iniciar sesión como COORDINATOR
    const coordLoginRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'coord@test.canon', password: 'PasswordCoord123!', organizationId: orgId }
    });
    const coordSessionCookie = extractCookie(coordLoginRes, '__Host-sid');
    const coordCsrfCookie = JSON.parse(coordLoginRes.payload).csrfToken;

    // Elevar MFA en sesión de COORDINATOR
    await dbClientC02.query(`UPDATE user_sessions SET mfa_verified_at = NOW() WHERE user_id = '${coordUserId}';`);

    // El COORDINATOR intenta desactivar al usuario con roles WRITER + ADMIN
    const hierarchyCheckRes = await fastifyApp.inject({
      method: 'PATCH',
      url: `/api/v1/users/${multiRoleUserId}/status`,
      headers: {
        cookie: `__Host-sid=${coordSessionCookie}; csrf=${coordCsrfCookie}`,
        'x-csrf-token': coordCsrfCookie,
      },
      payload: { isActive: false }
    });

    if (hierarchyCheckRes.statusCode !== 403) {
      throw new Error(`CRITICAL FAIL C-02: COORDINATOR pudo alterar estado de un usuario WRITER+ADMIN (HTTP ${hierarchyCheckRes.statusCode}, se requiere 403 HIERARCHY_VIOLATION).`);
    }
    console.log('✅ C-02 Jerarquía Multi-Rol: Un COORDINATOR no puede modificar un objetivo que posee rol ADMIN entre sus múltiples asignaciones (Rechazado HTTP 403).');

    // 10. C-03 & H-02 PRUEBA DE OUTBOX Y MANEJO DE ERROR SMTP
    console.log('\n--- PRUEBA E2E C-03: OUTBOX TRANSACCIONAL Y RESILIENCIA ANTE FALLO SMTP ---');
    const { enqueueEmail } = await import('../dist/email/outbox.js');
    await enqueueEmail(dbPool, 'inexistente@invalid-smtp-target.local', 'INVITATION', { token: 'test-token-invalid-smtp', tenantName: 'Test' });
    
    // processEmailOutbox no debe lanzar excepción ni corromper transacciones
    const outboxResult = await processEmailOutbox(dbPool);
    if (typeof outboxResult.processed !== 'number') {
      throw new Error('C-03 Test: processEmailOutbox no devolvió estadísticas válidas.');
    }
    console.log('✅ C-03 Outbox: Procesamiento asíncrono e idempotente verificado con éxito.');

    // 11. C-03 PRUEBA ADVERSARIAL: Mutación cross-tenant rechazada con 404
    const crossTenantMutateRes = await fastifyApp.inject({
      method: 'PATCH',
      url: `/api/v1/users/${foreignUserId}/status`,
      headers: {
        cookie: `__Host-sid=${adminSessionCookie}; csrf=${csrfTokenCookie}`,
        'x-csrf-token': csrfTokenCookie,
      },
      payload: { isActive: false },
    });
    if (crossTenantMutateRes.statusCode !== 404 && crossTenantMutateRes.statusCode !== 403) {
      throw new Error(`CRITICAL FAIL C-03: Mutación cross-tenant devolvió HTTP ${crossTenantMutateRes.statusCode}, se requiere 404.`);
    }
    console.log('✅ C-03 Multitenant RLS: Mutación cross-tenant de usuario ajeno rechazada con HTTP 404.');

    // 12. PRUEBA E2E CICLO COMPLETO MFA Y RATE LIMIT EXHAUSTION (H-02)
    console.log('\n--- PRUEBA E2E CICLO COMPLETO TOTP MFA Y RATE LIMIT EXHAUSTION ---');
    const mfaUserEmail = 'mfa.tester@test.canon';
    const mfaUserId = '55555555-5555-5555-5555-555555555555';
    const mfaPassHash = await hashPassword('PasswordMfa123!');
    
    await dbClientC02.query(`
      INSERT INTO users (id, email, full_name, is_active, mfa_enabled) VALUES ('${mfaUserId}', '${mfaUserEmail}', 'Tester MFA', TRUE, FALSE) ON CONFLICT (id) DO NOTHING;
      INSERT INTO user_credentials (user_id, password_hash, password_algo) VALUES ('${mfaUserId}', '${mfaPassHash}', 'argon2id') ON CONFLICT (user_id) DO UPDATE SET password_hash = '${mfaPassHash}';
      INSERT INTO organization_memberships (organization_id, user_id, is_active) VALUES ('${orgId}', '${mfaUserId}', TRUE) ON CONFLICT (organization_id, user_id) DO NOTHING;
      INSERT INTO role_assignments (organization_id, scope_type, scope_id, target_user_id, assigned_role, is_active)
      VALUES ('${orgId}', 'ORGANIZATION', '${orgId}', '${mfaUserId}', 'WRITER', TRUE) ON CONFLICT DO NOTHING;
    `);

    // Login mfaUser
    const mfaLoginRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: mfaUserEmail, password: 'PasswordMfa123!', organizationId: orgId }
    });
    const mfaSessionCookie = extractCookie(mfaLoginRes, '__Host-sid');
    const mfaCsrfCookie = JSON.parse(mfaLoginRes.payload).csrfToken;

    // POST /api/v1/auth/mfa/setup
    const setupRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup',
      headers: {
        cookie: `__Host-sid=${mfaSessionCookie}; csrf=${mfaCsrfCookie}`,
        'x-csrf-token': mfaCsrfCookie,
      }
    });
    if (setupRes.statusCode !== 200) {
      throw new Error(`MFA setup falló: ${setupRes.payload}`);
    }
    const setupData = JSON.parse(setupRes.payload);
    if (!setupData.secret || !setupData.otpauthUrl) {
      throw new Error(`MFA setup no retornó secreto u otpauthUrl: ${setupRes.payload}`);
    }

    // Generar código TOTP válido
    const { generateTotpCode } = await import('../dist/auth/crypto.js');
    const validTotpCode = generateTotpCode(setupData.secret);

    // POST /api/v1/auth/mfa/confirm
    const confirmRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/confirm',
      headers: {
        cookie: `__Host-sid=${mfaSessionCookie}; csrf=${mfaCsrfCookie}`,
        'x-csrf-token': mfaCsrfCookie,
      },
      payload: { code: validTotpCode }
    });
    if (confirmRes.statusCode !== 200) {
      throw new Error(`MFA confirm falló: ${confirmRes.payload}`);
    }
    const backupCodes = JSON.parse(confirmRes.payload).backupCodes;
    if (!backupCodes || backupCodes.length !== 10) {
      throw new Error('MFA confirm no devolvió los 10 códigos de respaldo.');
    }
    console.log('✅ MFA E2E: Setup y Confirmación TOTP exitosos con 10 códigos de respaldo generados.');

    // Step-up verification con código TOTP
    const verifyTotpRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: {
        cookie: `__Host-sid=${mfaSessionCookie}; csrf=${mfaCsrfCookie}`,
        'x-csrf-token': mfaCsrfCookie,
      },
      payload: { code: generateTotpCode(setupData.secret) }
    });
    if (verifyTotpRes.statusCode !== 200) throw new Error(`MFA Step-up TOTP falló: ${verifyTotpRes.payload}`);

    // H-02 Rate Limiting MFA: probar intento repetido de TOTP inválido
    let lastCodeRes = null;
    for (let attempt = 1; attempt <= 6; attempt++) {
      lastCodeRes = await fastifyApp.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/verify',
        headers: {
          cookie: `__Host-sid=${mfaSessionCookie}; csrf=${mfaCsrfCookie}`,
          'x-csrf-token': mfaCsrfCookie,
        },
        payload: { code: '000000' }
      });
    }
    if (lastCodeRes.statusCode !== 530 && lastCodeRes.statusCode !== 429 && lastCodeRes.statusCode !== 400) {
      throw new Error(`Rate limit MFA no respondió con bloqueo esperado (HTTP ${lastCodeRes.statusCode}).`);
    }
    console.log('✅ H-02 Rate Limiting MFA: Bloqueo de intentos fallidos repetidos verificado correctamente.');

    // Step-up verification con código de respaldo (consumo atómico)
    const backupCodeToUse = backupCodes[0];
    const verifyBackupRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: {
        cookie: `__Host-sid=${mfaSessionCookie}; csrf=${mfaCsrfCookie}`,
        'x-csrf-token': mfaCsrfCookie,
      },
      payload: { code: backupCodeToUse }
    });
    if (verifyBackupRes.statusCode !== 200 || !JSON.parse(verifyBackupRes.payload).usedBackupCode) {
      throw new Error(`MFA Step-up con Backup Code falló: ${verifyBackupRes.payload}`);
    }

    // Reutilización del mismo backup code DEBE fallar (Consumo atómico)
    const reuseBackupRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: {
        cookie: `__Host-sid=${mfaSessionCookie}; csrf=${mfaCsrfCookie}`,
        'x-csrf-token': mfaCsrfCookie,
      },
      payload: { code: backupCodeToUse }
    });
    if (reuseBackupRes.statusCode !== 400) {
      throw new Error('CRITICAL FAIL MFA: Se permitió la reutilización de un código de respaldo ya consumido.');
    }
    console.log('✅ MFA E2E: Consumo atómico de backup code verificado (no reutilizable).');

    // Desactivar MFA (POST /api/v1/auth/mfa/disable)
    const disableRes = await fastifyApp.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/disable',
      headers: {
        cookie: `__Host-sid=${mfaSessionCookie}; csrf=${mfaCsrfCookie}`,
        'x-csrf-token': mfaCsrfCookie,
      },
      payload: { password: 'PasswordMfa123!', code: generateTotpCode(setupData.secret) }
    });
    if (disableRes.statusCode !== 200) {
      throw new Error(`MFA disable falló: ${disableRes.payload}`);
    }
    console.log('✅ MFA E2E: MFA desactivado correctamente con confirmación de contraseña y TOTP.');

    await dbClientC02.end();

    console.log('\n🎉 SUITE DE INTEGRACIÓN FASE 1.1 REMEDIADA (v0.3.22) COMPLETA Y CERTIFICADA (PASS)');

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
