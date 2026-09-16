const fs = require('fs');

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

let updatedCount = 0;
for (const doc of targetDocs) {
  if (fs.existsSync(doc)) {
    let content = fs.readFileSync(doc, 'utf8');
    if (content.includes('0.2.11')) {
      content = content.replaceAll('v0.2.11', 'v0.2.12');
      content = content.replaceAll('0.2.11', '0.2.12');
      fs.writeFileSync(doc, content, 'utf8');
      updatedCount++;
      console.log(`Updated ${doc} to v0.2.12`);
    } else {
      console.log(`No v0.2.11 references found in ${doc}`);
    }
  } else {
    console.log(`MISSING DOC: ${doc}`);
  }
}
console.log(`Total updated docs: ${updatedCount}/${targetDocs.length}`);
