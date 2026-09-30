import assert from 'node:assert/strict';
import { visibleDocuments } from '../dist/knowledge/catalog.js';
const context = {
  userId: 'writer', isAnonymous: false, activeOrganizationId: 'org', roles: ['WRITER'],
  organizationMemberships: [{ organizationId: 'org', isActive: true }],
  workspaceMemberships: [{ organizationId: 'org', workspaceId: 'space', role: 'WRITER', isActive: true }],
  authorityMemberships: [], effectiveRoleAssignments: [],
};
const document = { resourceId: 'doc', organizationId: 'org', workspaceId: 'space',
  title: 'Internal', classification: 'INTERNO', resourceState: 'DRAFT', createdAt: '2026-09-30T00:00:00Z' };
assert.equal(visibleDocuments(context, [document]).length, 1);
assert.equal(visibleDocuments(context, [{ ...document, organizationId: 'other' }]).length, 0);
assert.equal(visibleDocuments(context, [{ ...document, workspaceId: 'other' }]).length, 0);
assert.equal(visibleDocuments({ ...context, roles: ['ADMIN'], workspaceMemberships: [] }, [document]).length, 0);
assert.equal(visibleDocuments(context, [{ ...document, classification: 'CONFIDENCIAL', assignedUserId: 'writer' }]).length, 0);
const freshMfa = { ...context, mfaAgeSeconds: 0 };
assert.equal(visibleDocuments(freshMfa, [{ ...document, classification: 'RESTRINGIDO', assignedUserId: 'writer' }]).length, 1);
assert.equal(visibleDocuments(freshMfa, [{ ...document, classification: 'RESTRINGIDO', assignedUserId: 'another' }]).length, 0);
assert.equal(visibleDocuments({ ...context, mfaAgeSeconds: 901 }, [{ ...document, classification: 'CONFIDENCIAL', assignedUserId: 'writer' }]).length, 0);
assert.equal(visibleDocuments(context, [{ ...document, classification: 'PUBLICO' }]).length, 0);
assert.equal('assignedUserId' in visibleDocuments(context, [document])[0], false);
console.log('KNOWLEDGE_CATALOG_AUTHORIZATION_PASS: 10 checks');
// Isolated HTTP rejection: no external database/Redis is contacted.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://fixture:fixture@127.0.0.1:1/fixture';
process.env.REDIS_URL = 'redis://127.0.0.1:1';
process.env.SESSION_SECRET = 'isolated-knowledge-catalog-test-fixture-2026';
process.env.APP_BASE_URL = 'http://localhost:3000';
const { default: Fastify } = await import('fastify');
const { default: cookie } = await import('@fastify/cookie');
const { registerKnowledgeRoutes } = await import('../dist/knowledge/routes.js');
const { closeDbPool } = await import('../dist/db/client.js');
const { redisClient } = await import('../dist/redis/client.js');
const app = Fastify();
await app.register(cookie);
await app.register(registerKnowledgeRoutes);
try {
  const response = await app.inject({ method: 'GET', url: '/api/v1/knowledge/catalog' });
  assert.equal(response.statusCode, 401);
  assert.equal(response.headers['cache-control'], 'no-store');
  console.log('KNOWLEDGE_HTTP_UNAUTHENTICATED_PASS');
} finally {
  await app.close();
  await closeDbPool();
  redisClient.disconnect();
}
