import { Redis } from 'ioredis';
import { config } from '../config/env.js';

export const redisClient = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 50, 500);
  },
});

redisClient.on('error', (err) => {
  // Silent error logger to prevent unhandled error crashes during liveness probing
});

export async function checkRedisHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (redisClient.status === 'wait') {
      await redisClient.connect();
    }
    const pong = await redisClient.ping();
    if (pong === 'PONG') {
      return { ok: true };
    }
    return { ok: false, error: `Unexpected ping response: ${pong}` };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Redis ping failed' };
  }
}
