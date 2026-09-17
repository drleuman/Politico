import crypto from 'crypto';
import { config } from '../config/env.js';

function getEncryptionKey(): Buffer {
  const secret = config.mfaMasterKey || config.sessionSecret || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Cifra un token en texto claro usando AES-256-GCM para almacenamiento seguro en reposo en email_outbox (H-01).
 * Retorna una cadena codificada en formato `enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 */
export function encryptPayloadToken(rawToken: string): string {
  if (!rawToken || rawToken.startsWith('enc:') || rawToken === '[REDACTED]') {
    return rawToken;
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descifra un token cifrado previamente en reposo para su transmisión por correo.
 * Si la cadena no comienza por `enc:`, se retorna tal cual (transparencia de compatibilidad).
 */
export function decryptPayloadToken(encryptedToken: string): string {
  if (!encryptedToken || !encryptedToken.startsWith('enc:')) {
    return encryptedToken;
  }
  const parts = encryptedToken.split(':');
  if (parts.length !== 4) {
    return encryptedToken;
  }
  const [, ivHex, tagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
