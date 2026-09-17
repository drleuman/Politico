import crypto from 'crypto';
import { config } from '../config/env.js';

function getEncryptionKey(): Buffer {
  const secret = config.emailOutboxEncryptionKey || config.mfaMasterKey || config.sessionSecret || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Cifra un token en texto claro usando AES-256-GCM para almacenamiento seguro en reposo en email_outbox (H-01, H-03).
 * Retorna una cadena codificada con versión de clave en formato `v1:enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 */
export function encryptPayloadToken(rawToken: string): string {
  if (!rawToken || rawToken.startsWith('v1:enc:') || rawToken.startsWith('enc:') || rawToken === '[REDACTED]') {
    return rawToken;
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descifra un token cifrado previamente en reposo para su transmisión por correo.
 * Soporta versiones `v1:enc:` y legacy `enc:` (rotación transparente).
 */
export function decryptPayloadToken(encryptedToken: string): string {
  if (!encryptedToken) return encryptedToken;
  
  let parts: string[];
  if (encryptedToken.startsWith('v1:enc:')) {
    parts = encryptedToken.slice(7).split(':');
  } else if (encryptedToken.startsWith('enc:')) {
    parts = encryptedToken.slice(4).split(':');
  } else {
    return encryptedToken;
  }

  if (parts.length !== 3) {
    return encryptedToken;
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
