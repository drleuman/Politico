const fs = require('fs');
const path = require('path');

const targetFiles = [
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
  'docs/security/THREAT_MODEL.md',
  'docs/audits/PHASE_0_WALKTHROUGH.md'
];

for (const file of targetFiles) {
  if (fs.existsSync(file)) {
    let text = fs.readFileSync(file, 'utf8');
    text = text.replaceAll('v0.2.8', 'v0.2.9');
    text = text.replaceAll('0.2.8', '0.2.9');
    fs.writeFileSync(file, text, 'utf8');
    console.log(`Updated ${file} to v0.2.9`);
  }
}
