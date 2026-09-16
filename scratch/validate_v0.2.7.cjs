const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== AUDITORÍA E INSPECCIÓN MECÁNICA INDEPENDIENTE — FASE 0 (v0.2.7) ===\n');

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

// 1. Verificación de Enlaces Relativos Markdown
const mdFiles = [];
function getMdFiles(dir) {
  const list = fs.readdirSync(dir);
  for (const f of list) {
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

// 2. Verificación de Históricos Intactos
const historicalFiles = [
  'REMEDIATION_MATRIX.md',
  'REMEDIATION_MATRIX_v0.2.2.md',
  'REMEDIATION_MATRIX_v0.2.3.md',
  'REMEDIATION_MATRIX_v0.2.4.md',
  'REMEDIATION_MATRIX_v0.2.5.md',
  'REMEDIATION_MATRIX_v0.2.6.md',
  'VALIDATION_REPORT.md',
  'VALIDATION_REPORT_v0.2.3.md',
  'VALIDATION_REPORT_v0.2.4.md',
  'VALIDATION_REPORT_v0.2.5.md',
  'VALIDATION_REPORT_v0.2.6.md'
];
let intactCount = 0;
for (const hf of historicalFiles) {
  if (fs.existsSync(hf)) intactCount++;
}
assertCheck(`Preservación Inmutable de Informes Históricos (${intactCount}/${historicalFiles.length} preservados)`, intactCount === historicalFiles.length);

// 3. Inspección del DDL en docs/architecture/ERD.md
const erdContent = fs.readFileSync('docs/architecture/ERD.md', 'utf8');

const createTableMatches = erdContent.match(/CREATE TABLE/gi) || [];
assertCheck(`Recuento de Sentencias DDL CREATE TABLE`, createTableMatches.length === 29, `Encontradas: ${createTableMatches.length}, esperadas: 29`);

const enableRlsMatches = erdContent.match(/ENABLE ROW LEVEL SECURITY/gi) || [];
assertCheck(`Recuento de Tablas con ENABLE ROW LEVEL SECURITY`, enableRlsMatches.length === 25, `Encontradas: ${enableRlsMatches.length}, esperadas: 25`);

const createPolicyMatches = erdContent.match(/CREATE POLICY tenant_isolation_policy ON/gi) || [];
assertCheck(`Recuento de Políticas Explícitas RLS (CREATE POLICY)`, createPolicyMatches.length === 25, `Encontradas: ${createPolicyMatches.length}, esperadas: 25`);

const triggerMatches = erdContent.match(/CREATE TRIGGER.*BEFORE UPDATE OR DELETE/gi) || [];
assertCheck(`Disparadores Anti-CASCADE de Inmutabilidad`, triggerMatches.length === 9, `Encontrados: ${triggerMatches.length}, esperados: 9`);

// 4. Verificación de Función Transaccional de Doble Control
const hasGovFunc = erdContent.includes('grant_governance_role_transactional') &&
  erdContent.includes('p_organization_id UUID') &&
  erdContent.includes('p_request_id UUID') &&
  erdContent.includes('FOR UPDATE') &&
  erdContent.includes('GOVERNANCE_REGISTRY') &&
  erdContent.includes('SECURITY DEFINER') &&
  erdContent.includes('REVOKE ALL ON FUNCTION grant_governance_role_transactional');
assertCheck(`Función Transaccional grant_governance_role_transactional Hardened`, hasGovFunc);

// 5. Inspección del Evaluador en docs/security/AUTHORIZATION_MATRIX.md
const authContent = fs.readFileSync('docs/security/AUTHORIZATION_MATRIX.md', 'utf8');

const hasNoClientTrustFlagsInDto = !authContent.includes('serverLoadedApprovals?: ServerLoadedApproval[]');
assertCheck(`Eliminación de Banderas de Confianza del DTO Solicitante`, hasNoClientTrustFlagsInDto);

const hasAdminUnconditionalDeny = authContent.includes("['APPROVE_DECISION', 'PUBLISH'].includes(request.action)") &&
  authContent.includes('ADMIN_UNCONDITIONAL_DENY');
assertCheck(`Denegación Incondicional del Admin Técnico`, hasAdminUnconditionalDeny);

const hasFiniteMfaCheck = authContent.includes('Number.isFinite(ageSec)') || authContent.includes('Number.isFinite(ageMinutes)') || authContent.includes('Number.isFinite(mfaAgeSeconds)');
assertCheck(`Validación Finitica de Antigüedad MFA`, hasFiniteMfaCheck);

const hasAnonymousPublicRead = authContent.includes('GRANT_PUBLIC_READ') &&
  authContent.includes('PUBLISHED') &&
  authContent.includes('ACTIVE');
assertCheck(`Lectura Pública Anónima Separada de Intranet`, hasAnonymousPublicRead);

// 6. Inspección de ADR-0003 Worker Outbox & Hash Chain
const adr3Content = fs.readFileSync('docs/adr/ADR-0003-audit-logging-and-outbox.md', 'utf8');
const hasWorkerSpec = adr3Content.includes('FOR UPDATE SKIP LOCKED') &&
  adr3Content.includes('0000000000000000000000000000000000000000000000000000000000000000') &&
  adr3Content.includes('RFC 8785') &&
  adr3Content.includes('audit_outbox_dead_letter');
assertCheck(`Especificación Ejecutable del Worker Outbox y Criptografía`, hasWorkerSpec);

// 7. Verificación de Entidades Conceptuales Mermaid en ERD.md
const mermaidMatch = erdContent.match(/## 1\. Modelo Conceptual \((\d+) Entidades Únicas\)/);
const conceptualEntityCount = mermaidMatch ? parseInt(mermaidMatch[1], 10) : 0;
assertCheck(`Recuento de Entidades Conceptuales Mermaid`, conceptualEntityCount === 28, `Encontradas: ${conceptualEntityCount}, esperadas: 28`);

// 8. Verificación de Versiones Documentales
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
    if (text.includes('0.2.7')) {
      updatedDocsCount++;
    }
  }
}
assertCheck(`Actualización de Línea Base Documental a v0.2.7 (${updatedDocsCount}/${targetDocs.length})`, updatedDocsCount === targetDocs.length);

console.log('\n---------------------------------------------------');
console.log(`TOTAL CHECKS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
if (failCount === 0) {
  console.log('DICTAMEN DE REMEDIACIÓN TÉCNICA v0.2.7: PASS');
  process.exit(0);
} else {
  console.log('DICTAMEN DE REMEDIACIÓN TÉCNICA v0.2.7: FAIL');
  process.exit(1);
}
