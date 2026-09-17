import pg from 'pg';
import { processEmailOutbox } from '../dist/email/outbox.js';
import { checkEmailWorkerSecurity } from '../dist/db/client.js';

const { Pool } = pg;
const workerDbUrl = process.env.EMAIL_WORKER_DATABASE_URL;

if (!workerDbUrl) {
  console.error('❌ ERROR FATAL (C-03): EMAIL_WORKER_DATABASE_URL no está definida en el entorno. El worker autónomo no puede utilizar la URL del rol web.');
  process.exit(1);
}

const workerPool = new Pool({
  connectionString: workerDbUrl,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

console.log('=== WORKER AUTÓNOMO DE CORREO ELECTRÓNICO OUTBOX — POLÍTICA CANON v0.3.25 ===');

let running = true;
const workerId = `email-worker-${process.pid}`;

async function runWorkerLoop() {
  const secCheck = await checkEmailWorkerSecurity(workerPool);
  if (!secCheck.ok) {
    console.error(`❌ ERROR FATAL (C-01, C-03): Falló la aserción de seguridad e identidad del worker: ${secCheck.error}`);
    process.exit(1);
  }

  console.log(`[OUTBOX WORKER] Identidad 'politica_canon_email_worker' verificada (${workerId})...`);
  
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
