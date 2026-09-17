import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/env.js';

export interface SentEmail {
  to: string;
  subject: string;
  body: string;
  sentAt: Date;
}

const sentEmailsStore: SentEmail[] = [];

export function getSentEmailsForTesting(): SentEmail[] {
  return [...sentEmailsStore];
}

export function clearSentEmailsForTesting(): void {
  sentEmailsStore.length = 0;
}

export function isEmailConfigured(): boolean {
  if (config.smtpHost && config.smtpPort) {
    return true;
  }
  if (config.nodeEnv === 'test') {
    return true;
  }
  return Boolean(
    config.smtpHost &&
    config.smtpPort &&
    config.smtpFrom
  );
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isEmailConfigured()) {
    return null;
  }
  if (!cachedTransporter && config.smtpHost && config.smtpPort) {
    const authObj = config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined;
    cachedTransporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure || false,
      auth: authObj,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return cachedTransporter;
}

export async function verifyEmailTransport(): Promise<boolean> {
  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.verify();
      return true;
    } catch (err) {
      console.error('[EMAIL ADAPTER] SMTP Transport verification failed:', err);
      return false;
    }
  }
  if (config.nodeEnv === 'test') {
    return true;
  }
  return false;
}

export async function sendInvitationEmail(to: string, token: string, tenantName: string = 'Política Canon', outboxId?: string): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  const acceptUrl = `${config.appBaseUrl}/accept-invitation?token=${token}`;
  const subject = `Invitación privada a ${tenantName}`;
  const text = `Ha sido invitado a acceder a ${tenantName}.\n\nPara activar su cuenta, haga clic en el siguiente enlace de un solo uso:\n${acceptUrl}\n\nEste enlace expirará en 24 horas.\nSi no solicitó esta invitación, puede ignorar este mensaje.`;
  const html = `<p>Ha sido invitado a acceder a <strong>${tenantName}</strong>.</p><p>Para activar su cuenta, haga clic en el siguiente enlace de un solo uso:</p><p><a href="${acceptUrl}">${acceptUrl}</a></p><p>Este enlace expirará en 24 horas.</p>`;

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: config.smtpFrom || 'no-reply@politica-canon.local',
        to,
        subject,
        text,
        html,
        messageId: outboxId ? `<outbox-${outboxId}@politica-canon.local>` : undefined,
      });
      return;
    } catch (err) {
      console.error('[EMAIL ADAPTER] Error sending invitation email via SMTP:', err);
      throw new Error('EMAIL_DELIVERY_FAILED');
    }
  }

  if (config.nodeEnv === 'test') {
    sentEmailsStore.push({
      to,
      subject,
      body: text,
      sentAt: new Date(),
    });
    return;
  }

  throw new Error('EMAIL_NOT_CONFIGURED');
}

export async function sendPasswordResetEmail(to: string, token: string, outboxId?: string): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  const resetUrl = `${config.appBaseUrl}/reset-password?token=${token}`;
  const subject = `Restablecimiento de contraseña — Política Canon`;
  const text = `Se ha solicitado la recuperación de contraseña para su cuenta.\n\nPara restablecer su contraseña, use el siguiente enlace de un solo uso:\n${resetUrl}\n\nEste enlace expirará en 15 minutos.\nSi no solicitó este cambio, ignore este mensaje.`;
  const html = `<p>Se ha solicitado la recuperación de contraseña para su cuenta.</p><p>Para restablecer su contraseña, use el siguiente enlace:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Este enlace expirará en 15 minutos.</p>`;

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: config.smtpFrom || 'no-reply@politica-canon.local',
        to,
        subject,
        text,
        html,
        messageId: outboxId ? `<outbox-${outboxId}@politica-canon.local>` : undefined,
      });
      return;
    } catch (err) {
      console.error('[EMAIL ADAPTER] Error sending password reset email via SMTP:', err);
      throw new Error('EMAIL_DELIVERY_FAILED');
    }
  }

  if (config.nodeEnv === 'test') {
    sentEmailsStore.push({
      to,
      subject,
      body: text,
      sentAt: new Date(),
    });
    return;
  }

  throw new Error('EMAIL_NOT_CONFIGURED');
}
