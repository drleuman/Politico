import { dbPool, closeDbPool } from '../dist/db/client.js';
import { processEmailOutbox } from '../dist/email/outbox.js';

console.log('=== WORKER AUTÓNOMO DE CORREO ELECTRÓNICO OUTBOX — POLÍTICA CANON v0.3.23 ===');

let running = true;
const workerId = `email-worker-${process.pid}`;

async function runWorkerLoop() {
  console.log(`[OUTBOX WORKER] Worker iniciado (${workerId})...`);
  
  const shutdown = async (signal) => {
    console.log(`[OUTBOX WORKER] Apagando worker (${signal})...`);
    running = false;
    await closeDbPool().catch(() => {});
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  while (running) {
    try {
      const { processed, failed } = await processEmailOutbox(dbPool, workerId);
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
