import pg from 'pg';
import { processEmailOutbox } from '../dist/email/outbox.js';
import { config } from '../dist/config/env.js';

const { Pool } = pg;
const workerDbUrl = process.env.EMAIL_WORKER_DATABASE_URL || config.emailWorkerDatabaseUrl || config.databaseUrl;

const workerPool = new Pool({
  connectionString: workerDbUrl,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

console.log('=== WORKER AUTÓNOMO DE CORREO ELECTRÓNICO OUTBOX — POLÍTICA CANON v0.3.24 ===');

let running = true;
const workerId = `email-worker-${process.pid}`;

async function runWorkerLoop() {
  console.log(`[OUTBOX WORKER] Worker iniciado (${workerId})...`);
  
  const shutdown = async (signal) => {
    console.log(`[OUTBOX WORKER] Apagando worker (${signal})...`);
    running = false;
    await workerPool.end().catch(() => {});
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  while (running) {
    try {
      const { processed, failed } = await processEmailOutbox(workerPool, workerId);
      if (processed > 0 || failed > 0) {
        console.log(`[OUTBOX WORKER] Procesados: ${processed}, Fallidos: ${failed}`);
      }
    } catch (err) {
      console.error('[OUTBOX WORKER] Error en iteración:', err.message);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

runWorkerLoop().catch(err => {
  console.error('[OUTBOX WORKER FATAL]', err);
  process.exit(1);
});
