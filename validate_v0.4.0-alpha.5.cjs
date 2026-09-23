const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const VERSION = '0.4.0-alpha.5';
let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed++; console.log(`[PASS] ${label}`); }
  else { failed++; console.error(`[FAIL] ${label}`); }
}

console.log(`=== VALIDACIÓN INDEPENDIENTE DE REMEDIACIÓN — v${VERSION} ===`);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
check('Versión y comandos canónicos', pkg.version === VERSION &&
  pkg.scripts['bootstrap:pre'] === 'node scripts/bootstrap-pre.mjs' &&
  pkg.scripts['migrate:prod'] === 'node scripts/migrate-production.mjs' &&
  pkg.scripts['bootstrap:post'] === 'node scripts/bootstrap-post.mjs' &&
  pkg.scripts['preflight:prod'] === 'node scripts/preflight-production.mjs' &&
  !JSON.stringify(pkg.scripts).includes('drizzle'));

check('Driver pg pertenece a dependencies runtime', Boolean(pkg.dependencies?.pg) && !pkg.devDependencies?.pg);

for (const command of [['run', 'typecheck'], ['run', 'build'], ['run', 'test:security']]) {
  execFileSync('npm', command, { stdio: 'pipe', shell: process.platform === 'win32' });
}
check('TypeScript, build y regresiones de seguridad', true);

const html = fs.readFileSync('public/index.html', 'utf8');
const dialog = fs.readFileSync('public/js/confirm-dialog.js', 'utf8');
check('Frontend sin sinks innerHTML y perfil conectado al endpoint real',
  !/\.innerHTML\s*=/.test(html + dialog) && html.includes("fetch('/api/v1/auth/me')"));
check('Roles del selector alineados y sin ADMIN directo',
  html.includes('value="WRITER"') && html.includes('value="REVIEWER"') &&
  !html.includes('value="ADMIN"') && !html.includes('value="admin"') && !html.includes('value="user"'));

const cryptoPayload = fs.readFileSync('src/email/crypto-payload.ts', 'utf8');
const invitation = fs.readFileSync('src/auth/invitations.ts', 'utf8');
check('Descifrado outbox y delegación RBAC fallan cerrado',
  cryptoPayload.includes("throw new Error('PAYLOAD_DECRYPTION_FAILED')") &&
  invitation.includes('INVITABLE_ROLES_BY_ACTOR') && invitation.includes('INVITATION_ROLE_NOT_DELEGABLE'));

const provision = fs.readFileSync('deploy/scripts/provision.sh', 'utf8');
const activate = fs.readFileSync('deploy/scripts/activate-release.sh', 'utf8');
const preflight = fs.readFileSync('scripts/preflight-production.mjs', 'utf8');
check('Provisión no activa servicios; activación exige backup, 3 fases y preflight',
  !/^systemctl enable/m.test(provision) && !/^systemctl start/m.test(provision) &&
  activate.includes('pg_dump') && activate.includes('npm run bootstrap:pre') &&
  activate.includes('npm run migrate:prod') && activate.includes('npm run bootstrap:post') &&
  activate.includes('npm run preflight:prod') && activate.includes('enable --now'));
check('Preflight acredita checksums, identidad runtime/worker, FORCE RLS, Redis y SMTP',
  preflight.includes('schema_migrations') && preflight.includes('politica_canon_app') &&
  preflight.includes('politica_canon_email_worker') && preflight.includes('rls_forced') &&
  preflight.includes('redis.ping()') && preflight.includes('verifyEmailTransport()'));

const activeMetadataFiles = [
  'package.json', 'src/server.ts', 'scripts/migrate-production.mjs', 'scripts/email-worker.mjs',
  'scripts/test-integration-pg16.mjs', 'deploy/scripts/provision.sh',
  'deploy/systemd/politica-canon.service', 'deploy/systemd/politica-canon-outbox-worker.service',
  'deploy/plesk/vhost_nginx.conf', 'public/index.html'
];
check('Metadatos activos sincronizados', activeMetadataFiles.every((file) => fs.readFileSync(file, 'utf8').includes(VERSION)));

const markdownFiles = ['README.md', 'CHANGELOG.md', 'DEPLOYMENT_REPORT.md'];
const broken = [];
for (const file of markdownFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]+)?\)/g)) {
    if (!fs.existsSync(path.resolve(path.dirname(file), decodeURIComponent(match[1])))) broken.push(`${file}:${match[1]}`);
  }
}
check('Documentación activa sin enlaces locales rotos', broken.length === 0);

const smtp = fs.readFileSync('src/email/adapter.ts', 'utf8');
check('Configuración SMTP exige remitente', /config\.smtpHost\s*&&[\s\S]*config\.smtpPort\s*&&[\s\S]*config\.smtpFrom/.test(smtp));

console.log(`TOTAL: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
if (failed) process.exit(1);
