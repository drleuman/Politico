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
  created_at: Date;
  processed_at?: Date;
}

/**
 * Encola un mensaje de correo electrónico dentro de una transacción de base de datos activa.
 * C-03: Mantiene la atomicidad DB/Outbox sin bloquear la respuesta HTTP.
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
 * Procesa los mensajes pendientes en la tabla email_outbox de forma asíncrona e idempotente.
 */
export async function processEmailOutbox(pool: Pool): Promise<{ processed: number; failed: number }> {
  const client = await pool.connect();
  let processed = 0;
  let failed = 0;

  try {
    const pendingRes = await client.query<EmailOutboxRow>(
      `SELECT id, recipient, template, payload, attempts
       FROM email_outbox
       WHERE status = 'PENDING' AND attempts < 5
       ORDER BY created_at ASC
       LIMIT 10`
    );

    for (const msg of pendingRes.rows) {
      try {
        const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        if (msg.template === 'INVITATION') {
          await sendInvitationEmail(msg.recipient, payload.token, payload.tenantName);
        } else if (msg.template === 'PASSWORD_RESET') {
          await sendPasswordResetEmail(msg.recipient, payload.token);
        }

        await client.query(
          `UPDATE email_outbox SET status = 'SENT', processed_at = NOW() WHERE id = $1`,
          [msg.id]
        );
        processed++;
      } catch (err: any) {
        failed++;
        const nextAttempts = msg.attempts + 1;
        const newStatus = nextAttempts >= 5 ? 'FAILED' : 'PENDING';
        await client.query(
          `UPDATE email_outbox SET status = $1, attempts = $2, last_error = $3 WHERE id = $4`,
          [newStatus, nextAttempts, err.message || String(err), msg.id]
        );
      }
    }
  } finally {
    client.release();
  }

  return { processed, failed };
}
