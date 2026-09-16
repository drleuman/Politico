const fs = require('fs');
const crypto = require('crypto');

const ddl = fs.readFileSync('db/migrations/0001_initial_schema.sql', 'utf8');
const tables = (ddl.match(/CREATE TABLE/gi) || []).length;
console.log('CREATE TABLE count:', tables);

const historicalFiles = [
  'REMEDIATION_MATRIX.md',
  'REMEDIATION_MATRIX_v0.2.2.md',
  'REMEDIATION_MATRIX_v0.2.3.md',
  'REMEDIATION_MATRIX_v0.2.4.md',
  'REMEDIATION_MATRIX_v0.2.5.md',
  'REMEDIATION_MATRIX_v0.2.6.md',
  'REMEDIATION_MATRIX_v0.2.7.md',
  'REMEDIATION_MATRIX_v0.2.8.md',
  'REMEDIATION_MATRIX_v0.2.9.md',
  'REMEDIATION_MATRIX_v0.2.10.md',
  'VALIDATION_REPORT.md',
  'VALIDATION_REPORT_v0.2.3.md',
  'VALIDATION_REPORT_v0.2.4.md',
  'VALIDATION_REPORT_v0.2.5.md',
  'VALIDATION_REPORT_v0.2.6.md',
  'VALIDATION_REPORT_v0.2.7.md',
  'VALIDATION_REPORT_v0.2.8.md',
  'VALIDATION_REPORT_v0.2.9.md',
  'VALIDATION_REPORT_v0.2.10.md'
];

console.log('Historical hashes:');
for (const f of historicalFiles) {
  if (fs.existsSync(f)) {
    const h = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    console.log(`  '${f}': '${h}',`);
  } else {
    console.log(`MISSING: ${f}`);
  }
}
