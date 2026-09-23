import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { checkDatabaseHealth, closeDbPool } from './db/client.js';
import { checkRedisHealth, closeRedisClient } from './redis/client.js';
import { registerAuthRoutes } from './auth/routes.js';
import { verifyEmailTransport, isEmailConfigured } from './email/adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildServer() {
  const server = Fastify({
    logger: {
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
      redact: ['headers.authorization', 'headers.cookie', 'req.headers.cookie', 'body.password', 'body.token'],
    },
    trustProxy: true,
  });

  // Registra soporte de cookies HttpOnly
  server.register(fastifyCookie, {
    secret: config.sessionSecret || 'default_cookie_secret_change_in_production',
  });

  // Serve static files (React / Intranet private landing page)
  const publicPath = path.join(__dirname, 'public');
  server.register(fastifyStatic, {
    root: publicPath,
    prefix: '/',
  });

  // Registra rutas de autenticación, invitaciones, sesiones y MFA
  server.register(registerAuthRoutes);

  // GET /healthz — Liveness Probe (HTTP 200 OK without disclosing secrets)
  server.get('/healthz', async (request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // GET /readyz — Readiness Probe (Verifies PostgreSQL 16+, Redis 7 & SMTP connections)
  server.get('/readyz', async (request, reply) => {
    const [dbResult, redisResult, smtpOk] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      verifyEmailTransport(),
    ]);

    const isReady = dbResult.ok && redisResult.ok && smtpOk;
    const statusCode = isReady ? 200 : 503;

    return reply.status(statusCode).send({
      status: isReady ? 'ready' : 'unhealthy',
      database: dbResult.ok ? 'connected' : 'disconnected',
      redis: redisResult.ok ? 'connected' : 'disconnected',
      smtp: smtpOk ? 'connected' : (isEmailConfigured() ? 'failed' : 'not_configured'),
      timestamp: new Date().toISOString(),
    });
  });

  return server;
}

const server = buildServer();

async function shutdown(signal: string) {
  console.log(`[INFO] Recibida señal de apagado (${signal}). Cerrando monolito Fastify y conexiones...`);
  try {
    await server.close();
    await closeDbPool();
    await closeRedisClient();
    console.log('[INFO] Cierre de conexiones completado exitosamente.');
    process.exit(0);
  } catch (err: any) {
    console.error('Error durante el apagado del servidor:', err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function start() {
  try {
    await server.listen({ port: config.port, host: config.host });
    console.log(`[INFO] Política Canon Monolith API v0.4.0-alpha.6 listening at http://${config.host}:${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  start();
}
