import type { Pool, PoolClient } from 'pg';
import { sendInvitationEmail, sendPasswordResetEmail } from './adapter.js';

export interface EmailOutboxRow {
  id: string;
  recipient: string;
  template: string;
  payload: any;
  status: string;
  attempts: number;
  last_error?: string;
  next_attempt_at: Date;
  locked_at?: Date;
  locked_by?: string;
  created_at: Date;
  processed_at?: Date;
}

/**
 * Encola un mensaje de correo electrónico dentro de una transacción de base de datos activa.
 * C-04: Mantiene la atomicidad DB/Outbox sin ejecutar SMTP bloqueante en la ruta HTTP.
 */
export async function enqueueEmail(
  client: PoolClient | Pool,
  recipient: string,
  template: 'INVITATION' | 'PASSWORD_RESET',
  payload: Record<string, any>
): Promise<string> {
  const res = await client.query<{ id: string }>(
    `INSERT INTO email_outbox (recipient, template, payload, status)
     VALUES ($1, $2, $3, 'PENDING')
     RETURNING id`,
    [recipient, template, JSON.stringify(payload)]
  );
  return res.rows[0].id;
}

/**
 * Reclama y procesa los mensajes pendientes en email_outbox usando FOR UPDATE SKIP LOCKED (C-04).
 * Redacta tokens secretos del payload inmediatamente tras el envío exitoso (H-04).
 */
export async function processEmailOutbox(
  pool: Pool,
  workerId: string = `worker-${process.pid}`
): Promise<{ processed: number; failed: number }> {
  const client = await pool.connect();
  let processed = 0;
  let failed = 0;

  try {
    // 1. Recuperar bloqueos abandonados (>5 min en PROCESSING)
    await client.query(
      `UPDATE email_outbox
       SET status = 'PENDING', locked_at = NULL, locked_by = NULL
       WHERE status = 'PROCESSING' AND locked_at < NOW() - INTERVAL '5 minutes'`
    );

    // 2. Reclamar mensajes PENDING usando transacción y FOR UPDATE SKIP LOCKED
    await client.query('BEGIN');
    const claimRes = await client.query<EmailOutboxRow>(
      `SELECT id, recipient, template, payload, attempts
       FROM email_outbox
       WHERE (status = 'PENDING' AND next_attempt_at <= NOW() AND attempts < 5)
       ORDER BY created_at ASC
       LIMIT 10
       FOR UPDATE SKIP LOCKED`
    );

    if (claimRes.rows.length === 0) {
      await client.query('COMMIT');
      return { processed: 0, failed: 0 };
    }

    const claimedIds = claimRes.rows.map(r => r.id);
    await client.query(
      `UPDATE email_outbox
       SET status = 'PROCESSING', locked_at = NOW(), locked_by = $1
       WHERE id = ANY($2::uuid[])`,
      [workerId, claimedIds]
    );
    await client.query('COMMIT');

    // 3. Procesar individualmente los mensajes reclamados
    for (const msg of claimRes.rows) {
      try {
        const payloadObj = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : { ...msg.payload };
        const rawToken = payloadObj.token;

        if (msg.template === 'INVITATION') {
          await sendInvitationEmail(msg.recipient, rawToken, payloadObj.tenantName || 'Política Canon');
        } else if (msg.template === 'PASSWORD_RESET') {
          await sendPasswordResetEmail(msg.recipient, rawToken);
        }

        // Redactar secreto del payload (H-04) tras entrega exitosa
        if (payloadObj.token) {
          payloadObj.token = '[REDACTED]';
        }

        await client.query(
          `UPDATE email_outbox
           SET status = 'SENT',
               payload = $1,
               processed_at = NOW(),
               locked_at = NULL,
               locked_by = NULL
           WHERE id = $2`,
          [JSON.stringify(payloadObj), msg.id]
        );
        processed++;
      } catch (err: any) {
        failed++;
        const nextAttempts = msg.attempts + 1;
        const newStatus = nextAttempts >= 5 ? 'FAILED' : 'PENDING';
        // Backoff exponencial simple: 30s, 60s, 120s...
        const backoffSeconds = nextAttempts * 30;

        await client.query(
          `UPDATE email_outbox
           SET status = $1,
               attempts = $2,
               last_error = $3,
               next_attempt_at = NOW() + ($4 || ' seconds')::interval,
               locked_at = NULL,
               locked_by = NULL
           WHERE id = $5`,
          [newStatus, nextAttempts, err.message || String(err), backoffSeconds, msg.id]
        );
      }
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return { processed, failed };
}
