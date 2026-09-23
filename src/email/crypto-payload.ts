import crypto from 'crypto';
import { config } from '../config/env.js';

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

function getPrimaryEncryptionKey(): Buffer {
  const secret = config.emailOutboxEncryptionKey;
  if (!secret) {
    throw new Error('EMAIL_OUTBOX_ENCRYPTION_KEY_REQUIRED');
  }
  return deriveKey(secret);
}

function getCandidateKeysForLegacy(): Buffer[] {
  const keys: Buffer[] = [getPrimaryEncryptionKey()];
  const candidates = [
    config.emailOutboxLegacyKeyV0,
    config.mfaMasterKey,
    config.sessionSecret,
  ];

  for (const candidate of candidates) {
    if (candidate) {
      const derived = deriveKey(candidate);
      if (!keys.some((k) => k.equals(derived))) {
        keys.push(derived);
      }
    }
  }

  return keys;
}

function tryDecryptWithKey(key: Buffer, ivHex: string, tagHex: string, cipherHex: string): string | null {
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

function assertEncryptedPayloadParts(parts: string[]): [string, string, string] {
  if (parts.length !== 3) {
    throw new Error('PAYLOAD_DECRYPTION_FAILED');
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const isHex = (value: string): boolean => value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
  if (!isHex(ivHex) || !isHex(tagHex) || !isHex(cipherHex) || ivHex.length !== 24 || tagHex.length !== 32) {
    throw new Error('PAYLOAD_DECRYPTION_FAILED');
  }

  return [ivHex, tagHex, cipherHex];
}

/**
 * Cifra un token en texto claro usando AES-256-GCM para almacenamiento seguro en reposo en email_outbox (H-01, H-03).
 * Retorna una cadena codificada con versión de clave en formato `v1:enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 */
export function encryptPayloadToken(rawToken: string): string {
  if (!rawToken || rawToken.startsWith('v1:enc:') || rawToken.startsWith('enc:') || rawToken === '[REDACTED]') {
    return rawToken;
  }
  const key = getPrimaryEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descifra un token cifrado previamente en reposo para su transmisión por correo.
 * H-01: Soporta explícitamente la descifración de registros legacy `enc:` (v0.3.25) mediante la clave legacy/MFA.
 */
export function decryptPayloadToken(encryptedToken: string): string {
  if (!encryptedToken) return encryptedToken;
  
  let isV1 = false;
  let parts: string[];
  if (encryptedToken.startsWith('v1:enc:')) {
    isV1 = true;
    parts = encryptedToken.slice(7).split(':');
  } else if (encryptedToken.startsWith('enc:')) {
    parts = encryptedToken.slice(4).split(':');
  } else {
    return encryptedToken;
  }

  const [ivHex, tagHex, cipherHex] = assertEncryptedPayloadParts(parts);

  if (isV1) {
    const primaryKey = getPrimaryEncryptionKey();
    const result = tryDecryptWithKey(primaryKey, ivHex, tagHex, cipherHex);
    if (result === null) {
      throw new Error('PAYLOAD_DECRYPTION_FAILED');
    }
    return result;
  }

  // H-01: Para formato legacy enc:, probar la clave primaria y las claves de respaldo (emailOutboxLegacyKeyV0 / mfaMasterKey)
  const candidateKeys = getCandidateKeysForLegacy();
  for (const key of candidateKeys) {
    const decrypted = tryDecryptWithKey(key, ivHex, tagHex, cipherHex);
    if (decrypted !== null) {
      return decrypted;
    }
  }

  throw new Error('PAYLOAD_DECRYPTION_FAILED');
}
