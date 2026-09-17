import { dbPool } from '../db/client.js';
import { processEmailOutbox } from './outbox.js';

let isRunning = true;

export async function startOutboxWorkerLoop(intervalMs: number = 5000): Promise<void> {
  const workerId = `outbox-worker-${process.pid}`;
  console.log(`[EMAIL WORKER] Iniciando proceso de outbox (${workerId}) con intervalo de ${intervalMs}ms...`);

  while (isRunning) {
    try {
      const result = await processEmailOutbox(dbPool, workerId);
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
