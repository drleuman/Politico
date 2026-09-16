import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { checkDatabaseHealth } from './db/client.js';
import { checkRedisHealth } from './redis/client.js';

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

  // Serve static files (React / Intranet private landing page)
  const publicPath = path.join(__dirname, 'public');
  server.register(fastifyStatic, {
    root: publicPath,
    prefix: '/',
  });

  // GET /healthz — Liveness Probe (HTTP 200 OK without disclosing secrets)
  server.get('/healthz', async (request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // GET /readyz — Readiness Probe (Verifies PostgreSQL 16+ & Redis 7 connections)
  server.get('/readyz', async (request, reply) => {
    const [dbResult, redisResult] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const isReady = dbResult.ok && redisResult.ok;
    const statusCode = isReady ? 200 : 503;

    return reply.status(statusCode).send({
      status: isReady ? 'ready' : 'unhealthy',
      database: dbResult.ok ? 'connected' : 'disconnected',
      redis: redisResult.ok ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  });

  return server;
}

const server = buildServer();

async function start() {
  try {
    await server.listen({ port: config.port, host: config.host });
    console.log(`[INFO] Política Canon Monolith API listening at http://${config.host}:${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  start();
}
