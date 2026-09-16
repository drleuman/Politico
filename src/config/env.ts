import dotenv from 'dotenv';
import path from 'path';

// Load .env if present (for local dev), systemd EnvironmentFile takes precedence in production
dotenv.config();

export interface AppConfig {
  nodeEnv: string;
  port: number;
  host: string;
  appBaseUrl: string;
  databaseUrl: string;
  redisUrl: string;
  sessionSecret: string;
}

function validateConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '127.0.0.1';
  
  const appBaseUrl = process.env.APP_BASE_URL;
  const databaseUrl = process.env.DATABASE_URL || process.env.POLITICA_CANON_DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  const sessionSecret = process.env.SESSION_SECRET;

  const missing: string[] = [];
  if (!databaseUrl) missing.push('DATABASE_URL (or POLITICA_CANON_DATABASE_URL)');
  if (!redisUrl) missing.push('REDIS_URL');
  if (!sessionSecret) missing.push('SESSION_SECRET');
  if (!appBaseUrl) missing.push('APP_BASE_URL');

  if (missing.length > 0) {
    console.error(`[FATAL] Configuration validation failed closed. Missing required environment variables:\n  - ${missing.join('\n  - ')}`);
    process.exit(1);
  }

  if (sessionSecret && (sessionSecret.length < 32 || sessionSecret.includes('default_master_key') || sessionSecret.includes('change_in_production'))) {
    console.error('[FATAL] Configuration validation failed closed. SESSION_SECRET must be at least 32 characters in length and cannot use default placeholders.');
    process.exit(1);
  }

  return {
    nodeEnv,
    port,
    host,
    appBaseUrl: appBaseUrl!,
    databaseUrl: databaseUrl!,
    redisUrl: redisUrl!,
    sessionSecret: sessionSecret!,
  };
}

export const config = validateConfig();
