import { PoolClient } from 'pg';
import {
  generateTotpSecret,
  verifyTotpCode,
  encryptMfaSecret,
  decryptMfaSecret,
  generateMfaBackupCodes,
  hashToken,
  verifyPassword,
} from './crypto.js';
import { updateSessionMfaVerified } from './session.js';
import { recordSecurityAuditEvent } from '../audit/events.js';

/**
 * Inicia la configuración TOTP MFA generando un nuevo secreto y su URI otpauth://
 */
export async function setupMfa(
  client: PoolClient,
  params: {
    userId: string;
    organizationId: string;
    userEmail: string;
    masterKey: string;
  }
): Promise<{ secret: string; otpauthUrl: string }> {
  const { userId, userEmail, masterKey } = params;

  const { secret, otpauthUrl } = generateTotpSecret(userEmail);
  const encryptedSecret = encryptMfaSecret(secret, masterKey);

  await client.query(
    `UPDATE users SET mfa_secret_encrypted = $1 WHERE id = $2`,
    [encryptedSecret, userId]
  );

  return { secret, otpauthUrl };
}

/**
 * Confirma el enrolamiento TOTP con un código válido, generando los 10 códigos de respaldo
 */
export async function confirmMfa(
  client: PoolClient,
  params: {
    userId: string;
    organizationId: string;
    sessionId: string;
    code: string;
    masterKey: string;
  }
): Promise<{ backupCodes: string[] }> {
  const { userId, organizationId, sessionId, code, masterKey } = params;

  const userRes = await client.query(`SELECT mfa_secret_encrypted FROM users WHERE id = $1`, [userId]);
  if (userRes.rows.length === 0 || !userRes.rows[0].mfa_secret_encrypted) {
    throw new Error('MFA_NOT_INITIALIZED: Secreto TOTP no inicializado.');
  }

  const plainSecret = decryptMfaSecret(userRes.rows[0].mfa_secret_encrypted, masterKey);
  const isValid = verifyTotpCode(plainSecret, code);

  if (!isValid) {
    throw new Error('MFA_CODE_INVALID: Código TOTP incorrecto.');
  }

  // Generar y guardar 10 códigos de respaldo
  const { plainCodes, hashedCodes } = generateMfaBackupCodes(10);

  // Limpiar códigos anteriores si existían
  await client.query(`DELETE FROM mfa_backup_codes WHERE user_id = $1`, [userId]);

  for (const hCode of hashedCodes) {
    await client.query(
      `INSERT INTO mfa_backup_codes (organization_id, user_id, code_hash) VALUES ($1, $2, $3)`,
      [organizationId, userId, hCode]
    );
  }

  // Activar MFA en el usuario y actualizar la sesión activa
  await client.query(`UPDATE users SET mfa_enabled = TRUE WHERE id = $1`, [userId]);
  await updateSessionMfaVerified(client, sessionId);

  await recordSecurityAuditEvent(client, {
    organizationId,
    actorId: userId,
    eventType: 'MFA_ENABLED',
    payload: { userId },
  });

  return { backupCodes: plainCodes };
}

/**
 * Reautenticación / Paso elevado MFA (Step-up verification)
 * Renueva mfa_verified_at en la sesión para cumplir con el límite de frescura de 15 minutos (900s)
 */
export async function verifyMfaStepUp(
  client: PoolClient,
  params: {
    userId: string;
    organizationId: string;
    sessionId: string;
    code: string;
    masterKey: string;
  }
): Promise<{ verified: boolean; usedBackupCode?: boolean }> {
  const { userId, organizationId, sessionId, code, masterKey } = params;

  const userRes = await client.query(`SELECT mfa_secret_encrypted, mfa_enabled FROM users WHERE id = $1`, [userId]);
  if (userRes.rows.length === 0 || !userRes.rows[0].mfa_enabled || !userRes.rows[0].mfa_secret_encrypted) {
    throw new Error('MFA_NOT_ENABLED: El usuario no tiene MFA habilitado.');
  }

  const plainSecret = decryptMfaSecret(userRes.rows[0].mfa_secret_encrypted, masterKey);

  // Intentar primero verificación TOTP directa
  if (verifyTotpCode(plainSecret, code)) {
    await updateSessionMfaVerified(client, sessionId);
    await recordSecurityAuditEvent(client, {
      organizationId,
      actorId: userId,
      eventType: 'MFA_VERIFIED',
      payload: { userId, method: 'TOTP' },
    });
    return { verified: true, usedBackupCode: false };
  }

  // Intentar verificación mediante código de respaldo
  const codeHash = hashToken(code.trim().toUpperCase());
  const backupRes = await client.query(
    `SELECT id FROM mfa_backup_codes WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`,
    [userId, codeHash]
  );

  if (backupRes.rows.length > 0) {
    await client.query(`UPDATE mfa_backup_codes SET used_at = NOW() WHERE id = $1`, [backupRes.rows[0].id]);
    await updateSessionMfaVerified(client, sessionId);
    await recordSecurityAuditEvent(client, {
      organizationId,
      actorId: userId,
      eventType: 'MFA_VERIFIED',
      payload: { userId, method: 'BACKUP_CODE' },
    });
    return { verified: true, usedBackupCode: true };
  }

  throw new Error('MFA_CODE_INVALID: Código TOTP o de respaldo incorrecto.');
}

/**
 * Desactiva el MFA para un usuario exigiendo confirmación de contraseña y TOTP
 */
export async function disableMfa(
  client: PoolClient,
  params: {
    userId: string;
    organizationId: string;
    password: string;
    code: string;
    masterKey: string;
  }
): Promise<boolean> {
  const { userId, organizationId, password, code, masterKey } = params;

  const credRes = await client.query(`SELECT password_hash FROM user_credentials WHERE user_id = $1`, [userId]);
  if (credRes.rows.length === 0) throw new Error('CREDENTIALS_NOT_FOUND');

  const isPassValid = await verifyPassword(credRes.rows[0].password_hash, password);
  if (!isPassValid) throw new Error('PASSWORD_INVALID: Contraseña incorrecta.');

  const userRes = await client.query(`SELECT mfa_secret_encrypted FROM users WHERE id = $1`, [userId]);
  if (userRes.rows.length === 0 || !userRes.rows[0].mfa_secret_encrypted) {
    throw new Error('MFA_NOT_ENABLED');
  }

  const plainSecret = decryptMfaSecret(userRes.rows[0].mfa_secret_encrypted, masterKey);
  if (!verifyTotpCode(plainSecret, code)) {
    throw new Error('MFA_CODE_INVALID: Código TOTP incorrecto.');
  }

  await client.query(`UPDATE users SET mfa_enabled = FALSE, mfa_secret_encrypted = NULL WHERE id = $1`, [userId]);
  await client.query(`DELETE FROM mfa_backup_codes WHERE user_id = $1`, [userId]);

  await recordSecurityAuditEvent(client, {
    organizationId,
    actorId: userId,
    eventType: 'MFA_DISABLED',
    payload: { userId },
  });

  return true;
}
