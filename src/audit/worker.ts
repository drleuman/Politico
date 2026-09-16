import crypto from 'crypto';

export interface AuditOutboxItem {
  id: string;
  organization_id: string;
  event_type: string;
  actor_id: string;
  payload: any;
  retry_count: number;
}

export interface AuditEventEnvelope {
  eventId: string;
  organizationId: string;
  sequenceNumber: string;
  eventType: string;
  actorId: string;
  timestampIso: string;
  previousEventHash: string;
  payload: any;
  schemaVersion: string;
}

/**
 * Canonización JSON conforme a RFC 8785 (JSON Canonicalization Scheme - JCS)
 */
export function jcsCanonicalize(object: any): string {
  if (object === null || object === undefined) {
    return 'null';
  }
  if (typeof object === 'boolean' || typeof object === 'number') {
    return JSON.stringify(object);
  }
  if (typeof object === 'string') {
    return JSON.stringify(object);
  }
  if (Array.isArray(object)) {
    const items = object.map(item => jcsCanonicalize(item));
    return '[' + items.join(',') + ']';
  }
  if (typeof object === 'object') {
    const sortedKeys = Object.keys(object).sort();
    const keyValues = sortedKeys.map(key => {
      const val = jcsCanonicalize(object[key]);
      return JSON.stringify(key) + ':' + val;
    });
    return '{' + keyValues.join(',') + '}';
  }
  return JSON.stringify(object);
}

/**
 * Calcula el Hash SHA-256 canónico del sobre de evento
 */
export function computeEventHash(envelope: AuditEventEnvelope): string {
  const canonicalPayload = jcsCanonicalize(envelope.payload);
  const jcsEnvelope = jcsCanonicalize({
    eventId: envelope.eventId,
    organizationId: envelope.organizationId,
    sequenceNumber: envelope.sequenceNumber,
    eventType: envelope.eventType,
    actorId: envelope.actorId,
    timestampIso: envelope.timestampIso,
    previousEventHash: envelope.previousEventHash,
    payload: JSON.parse(canonicalPayload),
    schemaVersion: envelope.schemaVersion
  });
  return crypto.createHash('sha256').update(jcsEnvelope, 'utf8').digest('hex');
}

/**
 * Procesa un lote de outbox en una transacción por tenant respetando las políticas RLS
 */
export async function processOutboxBatchWithClient(client: any, workerId: string): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  // 1. Obtener los tenants que poseen eventos pendientes usando la función autorizada get_pending_outbox_tenants()
  // Sin fallback silencioso (H-05): falla cerrado si la función autorizada no está disponible
  const tenantRes = await client.query('SELECT organization_id FROM get_pending_outbox_tenants()');
  const pendingTenants: string[] = tenantRes.rows.map((r: any) => r.organization_id);

  if (pendingTenants.length === 0) {
    return { processed: 0, failed: 0 };
  }

  // 2. Procesar cada tenant en su propio ámbito de transacción con SET LOCAL app.current_organization_id
  for (const tenantId of pendingTenants) {
    await client.query('BEGIN');
    try {
      // Establecer variable de sesión local obligatoria dentro del bloque transaccional
      await client.query("SELECT set_config('app.current_organization_id', $1, true)", [tenantId]);

      // Reclamar outbox PENDING, FAILED re-intentables o PROCESSING caducados para este tenant
      const claimRes = await client.query(`
        UPDATE audit_outbox
        SET status = 'PROCESSING',
            claimed_at = NOW(),
            locked_by = $1
        WHERE (organization_id, id) IN (
          SELECT organization_id, id FROM audit_outbox
          WHERE organization_id = $2
            AND ((status = 'PENDING' OR (status = 'FAILED' AND next_attempt_at <= NOW()))
             OR (status = 'PROCESSING' AND claimed_at + (lease_duration_seconds || ' seconds')::interval < NOW()))
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 10
        )
        RETURNING id, organization_id, event_type, actor_id, payload, retry_count;
      `, [workerId, tenantId]);

      for (const item of claimRes.rows) {
        // Usar SAVEPOINT por elemento para aislar errores
        await client.query('SAVEPOINT item_sp');
        try {
          // Adquirir bloqueo consultivo por organización
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [item.organization_id]);

          // Obtener última secuencia y hash
          const lastRes = await client.query(`
            SELECT sequence_number, event_hash 
            FROM audit_events 
            WHERE organization_id = $1 
            ORDER BY sequence_number DESC 
            LIMIT 1 
            FOR UPDATE
          `, [item.organization_id]);

          const nextSeq = lastRes.rows.length > 0 ? BigInt(lastRes.rows[0].sequence_number) + 1n : 1n;
          const prevHash = lastRes.rows.length > 0 ? lastRes.rows[0].event_hash : '0'.repeat(64);

          const eventId = crypto.randomUUID();
          const timestampIso = new Date().toISOString();
          const schemaVersion = '1.0';

          const envelope: AuditEventEnvelope = {
            eventId,
            organizationId: item.organization_id,
            sequenceNumber: nextSeq.toString(),
            eventType: item.event_type,
            actorId: item.actor_id,
            timestampIso,
            previousEventHash: prevHash,
            payload: item.payload,
            schemaVersion
          };

          const eventHash = computeEventHash(envelope);

          // Insertar evento auditado inmutable
          await client.query(`
            INSERT INTO audit_events (
              id, organization_id, sequence_number, event_type, actor_id, outbox_id, payload, schema_version, previous_event_hash, event_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [eventId, item.organization_id, nextSeq.toString(), item.event_type, item.actor_id, item.id, item.payload, schemaVersion, prevHash, eventHash, timestampIso]);

          // Actualizar outbox a PROCESSED
          await client.query(`
            UPDATE audit_outbox 
            SET status = 'PROCESSED', processed_at = NOW(), error_log = NULL 
            WHERE organization_id = $1 AND id = $2
          `, [item.organization_id, item.id]);

          await client.query('RELEASE SAVEPOINT item_sp');
          processed++;
        } catch (itemErr: any) {
          await client.query('ROLLBACK TO SAVEPOINT item_sp');
          failed++;

          const nextRetry = item.retry_count + 1;
          if (nextRetry >= 5) {
            await client.query(`
              UPDATE audit_outbox SET status = 'DEAD_LETTER', error_log = $1 WHERE organization_id = $2 AND id = $3
            `, [itemErr.message, item.organization_id, item.id]);

            await client.query(`
              INSERT INTO audit_outbox_dead_letter (organization_id, outbox_id, error_message)
              VALUES ($1, $2, $3)
            `, [item.organization_id, item.id, itemErr.message]);
          } else {
            await client.query(`
              UPDATE audit_outbox 
              SET status = 'FAILED', retry_count = $1, error_log = $2, next_attempt_at = NOW() + INTERVAL '10 seconds' 
              WHERE organization_id = $3 AND id = $4
            `, [nextRetry, itemErr.message, item.organization_id, item.id]);
          }
        }
      }

      await client.query('COMMIT');
    } catch (batchErr) {
      await client.query('ROLLBACK');
      throw batchErr;
    }
  }

  return { processed, failed };
}

/**
 * Verificador criptográfico de cadena de auditoría (C-01: Ámbito Transaccional Protegido)
 */
export async function verifyAuditChainCrypted(client: any, organizationId: string): Promise<{ isValid: boolean; checkedCount: number; failedSeq?: string; error?: string }> {
  // Ejecutar dentro de un bloque de transacción explícito BEGIN...COMMIT para preservar set_config local (C-01)
  await client.query('BEGIN');
  let res: any;
  try {
    await client.query("SELECT set_config('app.current_organization_id', $1, true)", [organizationId]);
    res = await client.query(`
      SELECT * FROM audit_events 
      WHERE organization_id = $1 
      ORDER BY sequence_number ASC
    `, [organizationId]);
    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK');
    return { isValid: false, checkedCount: 0, error: `Transaction error: ${err.message}` };
  }

  if (res.rows.length === 0) {
    return { isValid: false, checkedCount: 0, error: 'NO_ACCESSIBLE_EVENTS_FOR_TENANT' };
  }

  let expectedSeq = 1n;
  let expectedPrevHash = '0'.repeat(64);

  for (const row of res.rows) {
    const seq = BigInt(row.sequence_number);
    if (seq !== expectedSeq) {
      return { isValid: false, checkedCount: Number(expectedSeq - 1n), failedSeq: row.sequence_number, error: `Sequence gap expected ${expectedSeq} found ${seq}` };
    }

    if (row.previous_event_hash !== expectedPrevHash) {
      return { isValid: false, checkedCount: Number(expectedSeq - 1n), failedSeq: row.sequence_number, error: `Previous hash mismatch` };
    }

    const envelope: AuditEventEnvelope = {
      eventId: row.id,
      organizationId: row.organization_id,
      sequenceNumber: row.sequence_number,
      eventType: row.event_type,
      actorId: row.actor_id,
      timestampIso: new Date(row.created_at).toISOString(),
      previousEventHash: row.previous_event_hash,
      payload: row.payload,
      schemaVersion: row.schema_version
    };

    const recalculatedHash = computeEventHash(envelope);
    if (recalculatedHash !== row.event_hash) {
      return { isValid: false, checkedCount: Number(expectedSeq - 1n), failedSeq: row.sequence_number, error: `Event hash cryptographic recalculation mismatch` };
    }

    expectedPrevHash = row.event_hash;
    expectedSeq++;
  }

  return { isValid: true, checkedCount: res.rows.length };
}
