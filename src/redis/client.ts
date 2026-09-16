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
  const sanitizedMsg = err.message ? err.message.replace(/redis:\/\/.*@/, 'redis://****@') : 'Redis connection error';
  // Log sanitized error message without credentials
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
    const sanitized = err.message ? err.message.replace(/redis:\/\/.*@/, 'redis://****@') : 'Redis ping failed';
    return { ok: false, error: sanitized };
  }
}

export async function closeRedisClient(): Promise<void> {
  try {
    if (redisClient.status !== 'end') {
      await redisClient.quit();
    }
  } catch (err: any) {
    redisClient.disconnect();
  }
}

