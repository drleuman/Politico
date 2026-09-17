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
  mfaMasterKey: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  smtpSecure?: boolean;
}

function validateConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '127.0.0.1';
  
  const appBaseUrl = process.env.APP_BASE_URL;
  const databaseUrl = process.env.DATABASE_URL || process.env.POLITICA_CANON_DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  const sessionSecret = process.env.SESSION_SECRET;
  const mfaMasterKey = process.env.MFA_MASTER_KEY || process.env.SESSION_SECRET; // Fallback to sessionSecret for dev if not set, but validate length

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM;
  const smtpSecure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1';

  const missing: string[] = [];
  if (!databaseUrl) missing.push('DATABASE_URL (or POLITICA_CANON_DATABASE_URL)');
  if (!redisUrl) missing.push('REDIS_URL');
  if (!sessionSecret) missing.push('SESSION_SECRET');
  if (!appBaseUrl) missing.push('APP_BASE_URL');

  if (nodeEnv === 'production') {
    if (!process.env.MFA_MASTER_KEY) missing.push('MFA_MASTER_KEY');
  }

  if (missing.length > 0) {
    console.error(`[FATAL] Configuration validation failed closed. Missing required environment variables:\n  - ${missing.join('\n  - ')}`);
    process.exit(1);
  }

  if (sessionSecret && (sessionSecret.length < 32 || sessionSecret.includes('default_master_key') || sessionSecret.includes('change_in_production'))) {
    console.error('[FATAL] Configuration validation failed closed. SESSION_SECRET must be at least 32 characters in length and cannot use default placeholders.');
    process.exit(1);
  }

  const effectiveMfaMasterKey = process.env.MFA_MASTER_KEY || sessionSecret!;
  if (effectiveMfaMasterKey.length < 32) {
    console.error('[FATAL] Configuration validation failed closed. MFA_MASTER_KEY must be at least 32 characters in length.');
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
    mfaMasterKey: effectiveMfaMasterKey,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    smtpSecure,
  };
}

export const config = validateConfig();
