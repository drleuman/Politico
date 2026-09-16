const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('=== AUDITORÍA E INSPECCIÓN MECÁNICA Y SEMÁNTICA RIGUROSA — FASE 0 (v0.2.10) ===\n');

let passCount = 0;
let failCount = 0;

function assertCheck(description, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${description}`);
    passCount++;
  } else {
    console.log(`[FAIL] ${description} ${details ? '(' + details + ')' : ''}`);
    failCount++;
  }
}

// 1. Verificación de Enlaces Relativos Markdown (0 enlaces rotos)
const mdFiles = [];
function getMdFiles(dir) {
  const list = fs.readdirSync(dir);
  for (const f of list) {
    if (f === 'node_modules' || f === 'dist' || f.startsWith('.')) continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      getMdFiles(p);
    } else if (f.endsWith('.md')) {
      mdFiles.push(p);
    }
  }
}
getMdFiles('.');

let totalLinks = 0;
let brokenLinks = 0;
for (const file of mdFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  for (const m of matches) {
    const link = m[2];
    if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('#')) continue;
    totalLinks++;
    const targetPath = path.resolve(path.dirname(file), link.split('#')[0]);
    if (!fs.existsSync(targetPath)) {
      brokenLinks++;
      console.log(`  -> Link roto en ${file}: ${link}`);
    }
  }
}
assertCheck(`Verificación de Enlaces Relativos Markdown (${totalLinks} inspeccionados)`, brokenLinks === 0, `${brokenLinks} rotos`);

// 2. Verificación Criptográfica Byte por Byte de los 17 Informes Históricos Intactos (SHA-256)
const historicalHashes = {
  'REMEDIATION_MATRIX.md': '6e9d49f36dcc4e144d3a48b3bd910017bf871548fab38fe0171242b318364fa0',
  'REMEDIATION_MATRIX_v0.2.2.md': '1d5e1e1edb6d18d0c7e3adf21c2ca46f2c6cdd51a56a47d2b42d52c798822c17',
  'REMEDIATION_MATRIX_v0.2.3.md': '4bcee14f357606991e651e5483b2dcb27f60d43a23e2d2029c3be8920ecf8674',
  'REMEDIATION_MATRIX_v0.2.4.md': '9282f111e0d24d882bd1a62cbd8d31a2bf1436f124f4904afc7a6c2a0e8de54e',
  'REMEDIATION_MATRIX_v0.2.5.md': '624c6178cc8d3210d5073196a0ef3c60e7c443568707cc21b1f732ee9c37f5a8',
  'REMEDIATION_MATRIX_v0.2.6.md': '7f6008dc9d61e9751965f927b57458ef473e355ef9e1832718d8ada5e2ee4ad5',
  'REMEDIATION_MATRIX_v0.2.7.md': 'bc0575070fbd1ae5d53a97f42dd8562ee359bb99ee7f1dbec30dffab2486f0f8',
  'REMEDIATION_MATRIX_v0.2.8.md': '2df9f0f508b869eb963e75bafd018e42461e82e7d6094b56a753bee94ac269a7',
  'REMEDIATION_MATRIX_v0.2.9.md': '9a2d11e3c214c8d3e1fd8f6c73af612b58c891ff3c1d6d0d38d41e648eb47969',
  'VALIDATION_REPORT.md': 'df4ff25ce327b8c95dc49bf76a76bb9ce25d599b89c02f08b1a447c3f8c2aa83',
  'VALIDATION_REPORT_v0.2.3.md': '3857bd436b09253a9b1fec7b0ef60a46de07cb123f0a1069ed8035116695cfd4',
  'VALIDATION_REPORT_v0.2.4.md': 'ce78e080a70032a9c2885db6af52723d70ca471ed76bf2c3bd86f52ea3f1488d',
  'VALIDATION_REPORT_v0.2.5.md': '1ede48e4226a33b1d23f695591ae32ecc0686bcbe696aed5487297b61188a5d4',
  'VALIDATION_REPORT_v0.2.6.md': 'ee396fc12d5c45d198596bff90dd9454D27B446A20E3721FD654ABB2EBF94E5F'.toLowerCase(),
  'VALIDATION_REPORT_v0.2.7.md': '2262010d22ac958efeac14baf11152cf3fc81324cfbefa674483b79ee75278cd',
  'VALIDATION_REPORT_v0.2.8.md': '0b627a9acd9e274f1b93cc3aa9433511edd70496c4fa9602b38b84943ae9ffa8',
  'VALIDATION_REPORT_v0.2.9.md': '94950d7a1548a59fec2c0bc7f8ff2d054ab862756d9d543dd662c96aa5eb86a5'
};

let intactCount = 0;
for (const [file, expectedHash] of Object.entries(historicalHashes)) {
  if (fs.existsSync(file)) {
    const data = fs.readFileSync(file);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    if (hash === expectedHash) {
      intactCount++;
    } else {
      console.log(`  -> HASH MISMATCH en ${file}: ${hash} vs ${expectedHash}`);
    }
  }
}
assertCheck(`Preservación Criptográfica Inmutable de Informes Históricos (${intactCount}/${Object.keys(historicalHashes).length} verificados)`, intactCount === Object.keys(historicalHashes).length);

// 3. Ejecución Real del Compilador TypeScript (tsc --noEmit) (H-01, H-02)
let tscPassed = false;
try {
  execSync('npm run typecheck', { encoding: 'utf8' });
  tscPassed = true;
} catch (err) {
  console.log(`  -> Error ejecutando tsc --noEmit: ${err.message}`);
}
assertCheck(`Compilación TypeScript Estricta (tsc --noEmit) sin Errores (H-01, H-02)`, tscPassed);

// 4. Verificación de DDL e Integridad de Esquema SQL (0001_initial_schema.sql)
const ddlContent = fs.readFileSync('db/migrations/0001_initial_schema.sql', 'utf8');

const createTableMatches = ddlContent.match(/CREATE TABLE/gi) || [];
assertCheck(`Recuento DDL CREATE TABLE en db/migrations/0001_initial_schema.sql`, createTableMatches.length === 29, `Encontradas: ${createTableMatches.length}, esperadas: 29`);

const enableRlsMatches = ddlContent.match(/ENABLE ROW LEVEL SECURITY/gi) || [];
assertCheck(`Recuento de Tablas con ENABLE ROW LEVEL SECURITY`, enableRlsMatches.length === 25, `Encontradas: ${enableRlsMatches.length}, esperadas: 25`);

const createPolicyMatches = ddlContent.match(/CREATE POLICY tenant_isolation_policy ON/gi) || [];
assertCheck(`Recuento de Políticas Explícitas RLS (CREATE POLICY)`, createPolicyMatches.length === 25, `Encontradas: ${createPolicyMatches.length}, esperadas: 25`);

const triggerMatches = ddlContent.match(/CREATE TRIGGER.*BEFORE UPDATE OR DELETE/gi) || [];
assertCheck(`Disparadores Anti-CASCADE de Inmutabilidad`, triggerMatches.length === 9, `Encontrados: ${triggerMatches.length}, esperados: 9`);

const hasProtectStatusTrigger = ddlContent.includes('protect_document_status_transitions') && ddlContent.includes('trg_protect_document_status');
assertCheck(`Protección Trigger DB contra Mutación Directa de Status (C-03)`, hasProtectStatusTrigger);

const hasVerifyAuditChainCrypto = ddlContent.includes('FUNCTION verify_audit_chain') && ddlContent.includes("digest(") && ddlContent.includes("'sha256'");
assertCheck(`Función PL/pgSQL verify_audit_chain con Recalculación SHA-256 (C-01)`, hasVerifyAuditChainCrypto);

const hasPendingOutboxTenantsRestricted = ddlContent.includes('FUNCTION get_pending_outbox_tenants') && ddlContent.includes('REVOKE ALL ON FUNCTION get_pending_outbox_tenants() FROM PUBLIC');
assertCheck(`Función PL/pgSQL get_pending_outbox_tenants Restringida (C-04)`, hasPendingOutboxTenantsRestricted);

const hasTargetAuthorityBody = ddlContent.includes('target_authority_body_id UUID') && ddlContent.includes('REFERENCES authority_bodies(organization_id, id)');
assertCheck(`Campo target_authority_body_id en Role Requests (C-02, C-06)`, hasTargetAuthorityBody);

// 5. Verificación de Bootstrap y Ownership de Esquema (bootstrap_roles.sql)
const bootstrapContent = fs.readFileSync('db/bootstrap_roles.sql', 'utf8');
const hasOwnerAssignment = bootstrapContent.includes('ALTER SCHEMA public OWNER TO app_owner') &&
  bootstrapContent.includes('ALTER TABLE documents OWNER TO app_owner');
assertCheck(`Asignación Real de Propiedad de Esquema y Objetos a app_owner (C-05)`, hasOwnerAssignment);

const hasRevokedPublicExecute = ddlContent.includes('REVOKE ALL ON FUNCTION grant_governance_role_transactional(UUID, UUID) FROM PUBLIC') &&
  bootstrapContent.includes('REVOKE ALL ON FUNCTION get_pending_outbox_tenants() FROM PUBLIC, app_user');
assertCheck(`Revocación de Permisos de Ejecución a PUBLIC en Funciones Elevadas (C-04)`, hasRevokedPublicExecute);

// 6. Verificación de Scripts Rollback
const hasDownMigration = fs.existsSync('db/migrations/0001_initial_schema_down.sql');
const hasBootstrapDown = fs.existsSync('db/bootstrap_roles_down.sql');
assertCheck(`Entrega de Migraciones Down (0001_initial_schema_down.sql y bootstrap_roles_down.sql) (H-05)`, hasDownMigration && hasBootstrapDown);

// 7. Pruebas Semánticas del Contrato de Autorización TypeScript (Node 24)
let tsAuthPassed = false;
try {
  const output = execSync('node --experimental-strip-types -e "import { runAuthorizationTests } from \'./src/auth/authorization.ts\'; const r = runAuthorizationTests(); console.log(JSON.stringify(r));"', { encoding: 'utf8' });
  const result = JSON.parse(output.trim().split('\n').pop());
  if (result.total === 6 && result.passed === 6 && result.failed === 0) {
    tsAuthPassed = true;
  }
} catch (err) {
  console.log(`  -> Error ejecutando pruebas de autorización TS: ${err.message}`);
}
assertCheck(`Pruebas Semánticas Adversariales de Autorización TypeScript (C-02)`, tsAuthPassed);

// 8. Análisis Dinámico del Diagrama Mermaid en docs/architecture/ERD.md (29 Entidades)
const erdContent = fs.readFileSync('docs/architecture/ERD.md', 'utf8');
const mermaidBlock = erdContent.match(/```mermaid([\s\S]*?)```/);
let mermaidEntities = new Set();
if (mermaidBlock) {
  const lines = mermaidBlock[1].split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('erDiagram')) continue;
    const parts = trimmed.split(/\|\|--\|\||\|\|--\|\{|\|\|--\}\||\|\}--\|\{|--/);
    if (parts.length >= 2) {
      const e1 = parts[0].trim();
      const e2 = parts[1].split(':')[0].trim();
      if (e1) mermaidEntities.add(e1);
      if (e2) mermaidEntities.add(e2);
    }
  }
}
assertCheck(`Conteo Dinámico de Entidades Conceptuales Mermaid en ERD.md`, mermaidEntities.size === 29, `Parseadas: ${mermaidEntities.size}, esperadas: 29`);

// 9. Verificación de Versiones Documentales Unificadas a v0.2.10
let updatedDocsCount = 0;
const targetDocs = [
  'README.md',
  'CHANGELOG.md',
  'PHASE_0_FINAL_ACCEPTANCE.md',
  'docs/00_ACTA_RATIFICACION_FASE_0.md',
  'docs/00_INDICE_CANONICO_DOCUMENTAL.md',
  'docs/01_PRD.md',
  'docs/03_ROLES_Y_PERMISOS.md',
  'docs/04_FLUJO_EDITORIAL.md',
  'docs/06_ARQUITECTURA_TECNICA.md',
  'docs/07_MODELO_DATOS.md',
  'docs/13_REGISTRO_DECISIONES.md',
  'docs/adr/ADR-0001-architecture.md',
  'docs/adr/ADR-0002-session-management.md',
  'docs/adr/ADR-0003-audit-logging-and-outbox.md',
  'docs/architecture/ERD.md',
  'docs/backlog/PHASE_1_BACKLOG.md',
  'docs/product/SCREEN_AND_FLOW_MAP.md',
  'docs/security/AUTHORIZATION_MATRIX.md',
  'docs/security/THREAT_MODEL.md'
];

for (const d of targetDocs) {
  if (fs.existsSync(d)) {
    const text = fs.readFileSync(d, 'utf8');
    if (text.includes('0.2.10')) {
      updatedDocsCount++;
    }
  }
}
assertCheck(`Actualización de Línea Base Documental a v0.2.10 (${updatedDocsCount}/${targetDocs.length})`, updatedDocsCount === targetDocs.length);

console.log('\n---------------------------------------------------');
console.log(`TOTAL CHECKS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
if (failCount === 0) {
  console.log('DICTAMEN DE REMEDIACIÓN TÉCNICA v0.2.10: PASS');
  process.exit(0);
} else {
  console.log('DICTAMEN DE REMEDIACIÓN TÉCNICA v0.2.10: FAIL');
  process.exit(1);
}
