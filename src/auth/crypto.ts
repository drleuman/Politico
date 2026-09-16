import argon2 from 'argon2';
import crypto from 'crypto';

/**
 * Hash de contraseña con Argon2id (mínimo 64MB memoria, 3 iteraciones, 4 hilos)
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verificación de contraseña contra hash Argon2id
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Validación de complejidad mínima de contraseña:
 * Mínimo 12 caracteres, al menos 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial.
 */
export function validatePasswordPolicy(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 12) {
    return { valid: false, reason: 'La contraseña debe tener al menos 12 caracteres.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'La contraseña debe incluir al menos una letra mayúscula.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'La contraseña debe incluir al menos una letra minúscula.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'La contraseña debe incluir al menos un número.' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, reason: 'La contraseña debe incluir al menos un carácter especial.' };
  }
  return { valid: true };
}

/**
 * Genera un token aleatorio de alta entropía (256 bits hex por defecto)
 */
export function generateHighEntropyToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Calcula el hash SHA-256 de un token para almacenamiento seguro
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Comparación segura en tiempo constante de cadenas de texto (para hashes/tokens)
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Decodifica Base32 RFC 4648 a Buffer
 */
function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

/**
 * Codifica Buffer a Base32 RFC 4648 sin padding
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Genera un código TOTP de 6 dígitos para un instante específico (RFC 6238, HMAC-SHA1, 30s)
 */
export function generateTotpCode(secretBase32: string, timeSeconds: number = Math.floor(Date.now() / 1000)): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(timeSeconds / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = codeInt % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verificación TOTP considerando una ventana de deriva (por defecto window=1 -> +/- 30s)
 */
export function verifyTotpCode(secretBase32: string, code: string, window = 1): boolean {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) return false;
  const now = Math.floor(Date.now() / 1000);
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const timeToTest = now + errorWindow * 30;
    const generated = generateTotpCode(secretBase32, timeToTest);
    if (timingSafeEqualString(generated, code)) {
      return true;
    }
  }
  return false;
}

/**
 * Genera un secreto TOTP aleatorio y su URI otpauth://
 */
export function generateTotpSecret(userEmail: string, issuer = 'PoliticaCanon'): { secret: string; otpauthUrl: string } {
  const randomBytes = crypto.randomBytes(20);
  const secret = base32Encode(randomBytes);
  const encodedEmail = encodeURIComponent(userEmail);
  const encodedIssuer = encodeURIComponent(issuer);
  const otpauthUrl = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  return { secret, otpauthUrl };
}

/**
 * Cifra un secreto MFA usando AES-256-GCM y una clave maestra derivada
 */
export function encryptMfaSecret(plainSecret: string, masterKey: string): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(masterKey, 'utf8').digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainSecret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Descifra un secreto MFA previamente cifrado con AES-256-GCM
 */
export function decryptMfaSecret(cipherText: string, masterKey: string): string {
  const parts = cipherText.split(':');
  if (parts.length !== 3) throw new Error('Formato cifrado MFA inválido');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  const key = crypto.createHash('sha256').update(masterKey, 'utf8').digest();

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Genera N códigos de respaldo de un solo uso en texto claro y sus correspondientes hashes SHA-256
 */
export function generateMfaBackupCodes(count = 10): { plainCodes: string[]; hashedCodes: string[] } {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A1B2C3D4"
    plainCodes.push(code);
    hashedCodes.push(hashToken(code));
  }

  return { plainCodes, hashedCodes };
}
