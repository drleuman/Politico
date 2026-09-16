const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const files = fs.readdirSync('.').filter(f => f.endsWith('.md') && (f.startsWith('REMEDIATION_MATRIX') || f.startsWith('VALIDATION_REPORT')));

console.log(`Encontrados ${files.length} archivos de informes/matrices.`);

const hashObj = {};
for (const f of files.sort()) {
  const content = fs.readFileSync(f, 'utf8');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  hashObj[f] = hash;
  console.log(`    '${f}': '${hash}',`);
}
