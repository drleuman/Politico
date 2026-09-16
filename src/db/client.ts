import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

export const dbPool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function checkDatabaseHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await dbPool.connect();
    try {
      await client.query('SELECT 1;');
      return { ok: true };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Database query failed' };
  }
}
