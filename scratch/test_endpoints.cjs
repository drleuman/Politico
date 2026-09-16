process.env.NODE_ENV = 'test';
process.env.PORT = '3999';
process.env.HOST = '127.0.0.1';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/politica_canon';
process.env.REDIS_URL = 'redis://127.0.0.1:6379/0';
process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef'; // 32 chars
process.env.APP_BASE_URL = 'https://peaceful-johnson.194-164-175-146.plesk.page';

const { buildServer } = require('../dist/server.js');

async function testEndpoints() {
  const server = buildServer();

  // Test /healthz endpoint
  const healthRes = await server.inject({
    method: 'GET',
    url: '/healthz',
  });
  console.log('[TEST] GET /healthz Status:', healthRes.statusCode, 'Payload:', healthRes.payload);

  if (healthRes.statusCode !== 200) {
    throw new Error('healthz endpoint failed');
  }

  // Test GET / (static index.html landing page)
  const rootRes = await server.inject({
    method: 'GET',
    url: '/',
  });
  console.log('[TEST] GET / Status:', rootRes.statusCode, 'HTML length:', rootRes.payload.length);
  if (rootRes.statusCode !== 200 || !rootRes.payload.includes('Política Canon — Intranet en preparación')) {
    throw new Error('root landing page test failed');
  }

  // Test GET /readyz endpoint (will return 503 if PG/Redis aren't listening, or 200 if connected)
  const readyRes = await server.inject({
    method: 'GET',
    url: '/readyz',
  });
  console.log('[TEST] GET /readyz Status:', readyRes.statusCode, 'Payload:', readyRes.payload);

  await server.close();
  console.log('[TEST] ALL ENDPOINT UNIT TESTS COMPLETED SUCCESSFULLY!');
}

testEndpoints().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
