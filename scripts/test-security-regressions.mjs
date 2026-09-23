import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';

const ephemeralSecret = () => crypto.randomBytes(32).toString('hex');

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://127.0.0.1:5432/test',
  EMAIL_WORKER_DATABASE_URL: 'postgresql://127.0.0.1:5432/test',
  REDIS_URL: 'redis://127.0.0.1:6379',
  APP_BASE_URL: 'http://localhost:3000',
  SESSION_SECRET: ephemeralSecret(),
  MFA_MASTER_KEY: ephemeralSecret(),
  EMAIL_OUTBOX_ENCRYPTION_KEY: ephemeralSecret(),
});

const { encryptPayloadToken, decryptPayloadToken } = await import('../dist/email/crypto-payload.js');
const { processEmailOutbox } = await import('../dist/email/outbox.js');
const { clearSentEmailsForTesting, getSentEmailsForTesting } = await import('../dist/email/adapter.js');
const { assertInvitationRoleAllowed } = await import('../dist/auth/invitations.js');

const cipher = encryptPayloadToken('one-time-secret');
assert.equal(decryptPayloadToken(cipher), 'one-time-secret');
assert.throws(() => decryptPayloadToken('v1:enc:bad'), /PAYLOAD_DECRYPTION_FAILED/);

const wrongKey = spawnSync(process.execPath, ['--input-type=module', '-e', `
  import { decryptPayloadToken } from './dist/email/crypto-payload.js';
  try { decryptPayloadToken(process.env.TEST_CIPHER); process.exit(10); }
  catch (error) { if (error.message !== 'PAYLOAD_DECRYPTION_FAILED') process.exit(11); }
`], {
  cwd: process.cwd(),
  env: { ...process.env, TEST_CIPHER: cipher, EMAIL_OUTBOX_ENCRYPTION_KEY: ephemeralSecret() },
  encoding: 'utf8',
});
assert.equal(wrongKey.status, 0, `wrong-key child failed: ${wrongKey.stderr}`);

for (const allowed of ['COORDINATOR', 'WRITER', 'REVIEWER']) {
  assert.doesNotThrow(() => assertInvitationRoleAllowed(['ADMIN'], allowed));
}
for (const denied of ['ADMIN', 'APPROVER', 'PUBLISHER', 'AUDITOR', 'user', 'admin']) {
  assert.throws(() => assertInvitationRoleAllowed(['ADMIN'], denied), /INVITATION_ROLE_NOT_DELEGABLE/);
}
for (const allowed of ['WRITER', 'REVIEWER']) {
  assert.doesNotThrow(() => assertInvitationRoleAllowed(['COORDINATOR'], allowed));
}
assert.throws(() => assertInvitationRoleAllowed(['COORDINATOR'], 'COORDINATOR'), /INVITATION_ROLE_NOT_DELEGABLE/);

const updates = [];
let selectCount = 0;
const fakeClient = {
  async query(sql, params) {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('SELECT id, recipient')) {
      selectCount++;
      return selectCount === 1
        ? { rows: [{ id: '00000000-0000-0000-0000-000000000001', recipient: 'audit@example.test', template: 'INVITATION', payload: { token: 'v1:enc:bad' }, attempts: 0 }] }
        : { rows: [] };
    }
    if (normalized.includes('SET status = $1')) updates.push(params);
    return { rows: [], rowCount: 1 };
  },
  release() {},
};
const fakePool = { async connect() { return fakeClient; } };
clearSentEmailsForTesting();
const outboxResult = await processEmailOutbox(fakePool, 'security-regression-worker');
assert.deepEqual(outboxResult, { processed: 0, failed: 1 });
assert.equal(getSentEmailsForTesting().length, 0, 'ciphertext must never be sent');
assert.equal(updates[0][0], 'PENDING');
assert.equal(updates[0][2], 'PAYLOAD_DECRYPTION_FAILED');

const frontend = fs.readFileSync('public/index.html', 'utf8');
assert.ok(frontend.includes("fetch('/api/v1/auth/me')"));
assert.ok(!frontend.includes('container.innerHTML'));
assert.ok(!frontend.includes('value="admin"'));
assert.ok(!frontend.includes('value="user"'));

console.log('SECURITY_REGRESSIONS_PASS');
