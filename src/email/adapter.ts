import nodemailer from 'nodemailer';
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
  if (config.nodeEnv === 'test') {
    return true;
  }
  return Boolean(
    config.smtpHost &&
    config.smtpPort &&
    config.smtpUser &&
    config.smtpPass &&
    config.smtpFrom
  );
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!isEmailConfigured()) {
    return null;
  }
  if (!cachedTransporter && config.nodeEnv !== 'test') {
    cachedTransporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure || false,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  }
  return cachedTransporter;
}

export async function verifyEmailTransport(): Promise<boolean> {
  if (config.nodeEnv === 'test') {
    return true;
  }
  const transporter = getTransporter();
  if (!transporter) {
    return false;
  }
  try {
    await transporter.verify();
    return true;
  } catch (err) {
    console.error('[EMAIL ADAPTER] SMTP Transport verification failed:', err);
    return false;
  }
}

export async function sendInvitationEmail(to: string, token: string, tenantName: string = 'Política Canon'): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  const acceptUrl = `${config.appBaseUrl}/accept-invitation?token=${token}`;
  const subject = `Invitación privada a ${tenantName}`;
  const text = `Ha sido invitado a acceder a ${tenantName}.\n\nPara activar su cuenta, haga clic en el siguiente enlace de un solo uso:\n${acceptUrl}\n\nEste enlace expirará en 24 horas.\nSi no solicitó esta invitación, puede ignorar este mensaje.`;
  const html = `<p>Ha sido invitado a acceder a <strong>${tenantName}</strong>.</p><p>Para activar su cuenta, haga clic en el siguiente enlace de un solo uso:</p><p><a href="${acceptUrl}">${acceptUrl}</a></p><p>Este enlace expirará en 24 horas.</p>`;

  if (config.nodeEnv === 'test') {
    sentEmailsStore.push({
      to,
      subject,
      body: text,
      sentAt: new Date(),
    });
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  try {
    await transporter.sendMail({
      from: config.smtpFrom,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error('[EMAIL ADAPTER] Error sending invitation email via SMTP:', err);
    throw new Error('EMAIL_DELIVERY_FAILED');
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  const resetUrl = `${config.appBaseUrl}/reset-password?token=${token}`;
  const subject = `Restablecimiento de contraseña — Política Canon`;
  const text = `Se ha solicitado la recuperación de contraseña para su cuenta.\n\nPara restablecer su contraseña, use el siguiente enlace de un solo uso:\n${resetUrl}\n\nEste enlace expirará en 15 minutos.\nSi no solicitó este cambio, ignore este mensaje.`;
  const html = `<p>Se ha solicitado la recuperación de contraseña para su cuenta.</p><p>Para restablecer su contraseña, use el siguiente enlace:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Este enlace expirará en 15 minutos.</p>`;

  if (config.nodeEnv === 'test') {
    sentEmailsStore.push({
      to,
      subject,
      body: text,
      sentAt: new Date(),
    });
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  try {
    await transporter.sendMail({
      from: config.smtpFrom,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error('[EMAIL ADAPTER] Error sending password reset email via SMTP:', err);
    throw new Error('EMAIL_DELIVERY_FAILED');
  }
}
