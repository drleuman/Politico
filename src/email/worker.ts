import { emailWorkerPool, checkEmailWorkerSecurity } from '../db/client.js';
import { processEmailOutbox } from './outbox.js';
import { config } from '../config/env.js';

let isRunning = true;

export async function startOutboxWorkerLoop(intervalMs: number = 5000): Promise<void> {
  if (!config.emailWorkerDatabaseUrl) {
    console.error('❌ ERROR FATAL (C-03): EMAIL_WORKER_DATABASE_URL no está configurada. El worker autónomo no puede utilizar la URL del rol web.');
    process.exit(1);
  }

  const secCheck = await checkEmailWorkerSecurity(emailWorkerPool);
  if (!secCheck.ok) {
    console.error(`❌ ERROR FATAL (C-01, C-03): Falló la aserción de seguridad e identidad del worker: ${secCheck.error}`);
    process.exit(1);
  }

  const workerId = `outbox-worker-${process.pid}`;
  console.log(`[EMAIL WORKER] Identidad 'politica_canon_email_worker' verificada. Iniciando outbox (${workerId}) a ${intervalMs}ms...`);

  while (isRunning) {
    try {
      const result = await processEmailOutbox(emailWorkerPool, workerId);
      if (result.processed > 0 || result.failed > 0) {
        console.log(`[EMAIL WORKER] Lote procesado: ${result.processed} enviados, ${result.failed} fallidos.`);
      }
    } catch (err: any) {
      console.error('[EMAIL WORKER] Error en ciclo de procesamiento:', err.message);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

export function stopOutboxWorkerLoop(): void {
  isRunning = false;
  console.log('[EMAIL WORKER] Deteniendo bucle de worker de correo...');
}
