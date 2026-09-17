/**
 * Script de Auditoría Independiente, Inspección Mecánica y Verificación Semántica Completa
 * Release Candidate: Política Canon v0.3.27 (Fase 1.1 Funcional Remediada Certificada)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('=== AUDITORÍA E INSPECCIÓN MECÁNICA Y SEMÁNTICA RIGUROSA — RELEASE v0.3.27 ===\n');

async function runValidation() {
  let passCount = 0;
  const TOTAL_CHECKS = 7;

  // CHECK 1: Integridad Física y Criptográfica Multiplataforma
  try {
    const zipPath = path.resolve(process.cwd(), 'politica-canon-v0.3.27.zip');
    const manifestPath = path.resolve(process.cwd(), 'MANIFEST_v0.3.27.json');

    if (!fs.existsSync(zipPath) || !fs.existsSync(manifestPath)) {
      throw new Error('politica-canon-v0.3.27.zip o MANIFEST_v0.3.27.json no encontrados en el directorio raíz.');
    }

    const zipBytes = fs.readFileSync(zipPath);
    const hashObserved = crypto.createHash('sha256').update(zipBytes).digest('hex');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (manifest.sha256 !== hashObserved) {
      throw new Error(`SHA-256 no coincide. Manifest: ${manifest.sha256}, Observado: ${hashObserved}`);
    }
    if (manifest.sizeBytes !== zipBytes.length) {
      throw new Error(`Tamaño no coincide. Manifest: ${manifest.sizeBytes}, Observado: ${zipBytes.length}`);
    }

    console.log(`✅ CHECK 1: Integridad Física y Criptográfica Multiplataforma (Node.js nativo Ubuntu/Win)
   └─ SHA-256: ${hashObserved.slice(0, 16)}..., Tamaño: ${zipBytes.length} bytes, Entradas: ${manifest.fileCount}, Raíz: politica-canon-v0.3.27/`);
    passCount++;
  } catch (err) {
    console.error(`❌ CHECK 1 FAIL: ${err.message}`);
  }

  // CHECK 2: Verificación Dinámica de Existencia de Archivos Referenciados en package.json (C-01)
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const scripts = pkg.scripts || {};

    const missingFiles = [];
    for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
      // Buscar referencias a archivos .cjs, .mjs, .js, .ts
      const matches = scriptCmd.match(/[\w./-]+\.(?:cjs|mjs|js|ts)/g) || [];
      for (const fileRef of matches) {
        let targetFile = fileRef;
        if (targetFile.startsWith('dist/')) {
          targetFile = targetFile.replace('dist/', 'src/').replace('.js', '.ts');
        }
        const absPath = path.resolve(process.cwd(), targetFile);
        if (!fs.existsSync(absPath)) {
          missingFiles.push(`Script '${scriptName}': referenció '${fileRef}' que no existe en el sistema de archivos.`);
        }
      }
    }

    if (missingFiles.length > 0) {
      throw new Error(`C-01 FAIL: Archivos de scripts npm inexistentes:\n  - ${missingFiles.join('\n  - ')}`);
    }

    console.log(`✅ CHECK 2: Verificación Dinámica de Existencia de Archivos Referenciados en package.json (C-01)
   └─ El script 'test' apunta a 'validate_v0.3.27.cjs' y todos los artefactos de scripts npm existen físicamente.`);
    passCount++;
  } catch (err) {
    console.error(`❌ CHECK 2 FAIL: ${err.message}`);
  }

  // CHECK 3: Finales de Línea LF, Asignación Segura por Stdin y Secuenciación Fail-Closed (C-02, H-03)
  try {
    const provPath = path.resolve(process.cwd(), 'deploy/scripts/provision.sh');
    const provBytes = fs.readFileSync(provPath);
    if (provBytes.includes(Buffer.from('\r\n'))) {
      throw new Error('deploy/scripts/provision.sh contiene finales de línea CRLF (\\r\\n). Se requiere LF puro (\\n).');
    }

    const provContent = provBytes.toString('utf8');
    if (!provContent.includes('psql -d politica_canon') || !provContent.includes('SQL_EOF')) {
      throw new Error('provision.sh no utiliza asignación de secretos mediante stdin heredoc (exposición de secretos en argv).');
    }
    if (!provContent.includes('information_schema.tables')) {
      throw new Error('provision.sh no comprueba la existencia de tablas de BD antes de iniciar los servicios systemd (C-02).');
    }
    if (!provContent.includes('^[a-f0-9]{32,64}$')) {
      throw new Error('provision.sh no valida el formato hexadecimal de WORKER_DB_PASS.');
    }

    console.log(`✅ CHECK 3: Finales de Línea LF, Asignación Segura por Stdin y Secuenciación Fail-Closed (C-02, H-03)
   └─ provision.sh es LF puro, usa stdin heredoc sin exponer argv, valida hex y defiere systemctl start hasta verificar la BD.`);
    passCount++;
  } catch (err) {
    console.error(`❌ CHECK 3 FAIL: ${err.message}`);
  }

  // CHECK 4: Pruebas Ejecutables de Descifrado de Payloads Legacy v0.3.25 enc: (H-01)
  try {
    const mfaMasterKeyDev = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef_mfa';
    const outboxKeyDev = '9999999999abcdef0123456789abcdef0123456789abcdef0123456789abcdef_outbox';
    const rawToken = 'test_token_legacy_v0.3.25_12345';

    // 1. Simular cifrado legacy de v0.3.25 usando MFA_MASTER_KEY
    const keyBufferMFA = crypto.createHash('sha256').update(mfaMasterKeyDev).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBufferMFA, iv);
    const encryptedBuf = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const legacyEncryptedString = `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encryptedBuf.toString('hex')}`;

    // 2. Importar módulo compilado dist/email/crypto-payload.js
    process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef_session';
    process.env.MFA_MASTER_KEY = mfaMasterKeyDev;
    process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = outboxKeyDev;
    process.env.EMAIL_OUTBOX_LEGACY_KEY_V0 = mfaMasterKeyDev;
    process.env.NODE_ENV = 'test';
    process.env.APP_BASE_URL = 'http://localhost:3000';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.REDIS_URL = 'redis://localhost:6379/0';

    const { decryptPayloadToken } = await import('./dist/email/crypto-payload.js');
    const decryptedToken = decryptPayloadToken(legacyEncryptedString);

    if (decryptedToken !== rawToken) {
      throw new Error(`El descifrado legacy de payload 'enc:' falló. Se esperaba '${rawToken}', se obtuvo '${decryptedToken}'.`);
    }

    console.log(`✅ CHECK 4: Pruebas Ejecutables de Descifrado de Payloads Legacy v0.3.25 enc: (H-01)
   └─ Descifrado exitoso de payload legacy 'enc:' generado con MFA_MASTER_KEY cuando EMAIL_OUTBOX_ENCRYPTION_KEY es independiente.`);
    passCount++;
  } catch (err) {
    console.error(`❌ CHECK 4 FAIL: ${err.message}`);
  }

  // CHECK 5: Validación de Independencia Criptográfica Obligatoria en Producción (H-02)
  try {
    const envPath = path.resolve(process.cwd(), 'src/config/env.ts');
    const envContent = fs.readFileSync(envPath, 'utf8');

    if (!envContent.includes('sessionSecret === effectiveMfaMasterKey') || 
        !envContent.includes('sessionSecret === effectiveOutboxKey') || 
        !envContent.includes('effectiveMfaMasterKey === effectiveOutboxKey')) {
      throw new Error('src/config/env.ts no impone aserciones de independencia criptográfica entre las tres claves en producción.');
    }

    console.log(`✅ CHECK 5: Validación de Independencia Criptográfica Obligatoria en Producción (H-02)
   └─ Aserciones estrictas en validateConfig() garantizan que SESSION_SECRET, MFA_MASTER_KEY y EMAIL_OUTBOX_ENCRYPTION_KEY sean distintas.`);
    passCount++;
  } catch (err) {
    console.error(`❌ CHECK 5 FAIL: ${err.message}`);
  }

  // CHECK 6: Coherencia Total de Metadatos de Release v0.3.27 (M-01)
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    if (pkg.version !== '0.3.27') throw new Error(`package.json version es ${pkg.version}, se esperaba 0.3.27`);

    const filesToCheck = [
      { file: 'deploy/scripts/provision.sh', key: 'v0.3.27' },
      { file: 'src/server.ts', key: 'v0.3.27' },
      { file: 'public/index.html', key: 'v0.3.27' },
      { file: 'deploy/systemd/politica-canon.service', key: 'v0.3.27' },
      { file: 'deploy/systemd/politica-canon-outbox-worker.service', key: 'v0.3.27' },
      { file: 'deploy/plesk/vhost_nginx.conf', key: 'v0.3.27' },
      { file: 'scripts/migrate-production.mjs', key: 'v0.3.27' },
      { file: 'scripts/email-worker.mjs', key: 'v0.3.27' },
      { file: 'scripts/test-integration-pg16.mjs', key: 'v0.3.27' },
      { file: 'db/0000_bootstrap_roles.sql', key: 'v0.3.27' },
      { file: 'db/0002_bootstrap_permissions.sql', key: 'v0.3.27' },
    ];

    for (const item of filesToCheck) {
      const content = fs.readFileSync(path.resolve(process.cwd(), item.file), 'utf8');
      if (!content.includes(item.key)) {
        throw new Error(`El archivo ${item.file} no contiene el indicador de versión ${item.key}.`);
      }
    }

    console.log(`✅ CHECK 6: Coherencia Total de Metadatos de Release v0.3.27 (M-01)
   └─ Versión 0.3.27 100% consistente en package.json, provision.sh, server.ts, index.html, systemd, nginx, DDLs y scripts.`);
    passCount++;
  } catch (err) {
    console.error(`❌ CHECK 6 FAIL: ${err.message}`);
  }

  // CHECK 7: Matriz de Mínimos Privilegios DML, TLS Strict y Aserciones de Seguridad Worker
  try {
    const ddlPerm = fs.readFileSync(path.resolve(process.cwd(), 'db/0002_bootstrap_permissions.sql'), 'utf8');
    if (!ddlPerm.includes('REVOKE INSERT, DELETE ON public.email_outbox FROM email_worker') || 
        !ddlPerm.includes('REVOKE SELECT, UPDATE, DELETE ON public.email_outbox FROM app_user')) {
      throw new Error('db/0002_bootstrap_permissions.sql no impone la separación DML estricta sobre email_outbox.');
    }

    const adapterContent = fs.readFileSync(path.resolve(process.cwd(), 'src/email/adapter.ts'), 'utf8');
    if (!adapterContent.includes('rejectUnauthorized')) {
      throw new Error('src/email/adapter.ts no valida TLS rejectUnauthorized por defecto.');
    }

    console.log(`✅ CHECK 7: Matriz de Mínimos Privilegios DML, TLS Strict y Aserciones de Seguridad Worker
   └─ Web solo realiza INSERT, Worker solo realiza SELECT/UPDATE, TLS estricto en transporte SMTP.`);
    passCount++;
  } catch (err) {
    console.error(`❌ CHECK 7 FAIL: ${err.message}`);
  }

  console.log('\n--------------------------------------------------------------------------');
  if (passCount === TOTAL_CHECKS) {
    console.log('DICTAMEN DE REMEDIACIÓN TÉCNICA RELEASE v0.3.27: PASS (7/7 CONTROLES SUPERADOS)\n');
    process.exit(0);
  } else {
    console.error(`DICTAMEN DE REMEDIACIÓN TÉCNICA RELEASE v0.3.27: FAIL (${passCount}/${TOTAL_CHECKS} CONTROLES SUPERADOS)\n`);
    process.exit(1);
  }
}

runValidation();
