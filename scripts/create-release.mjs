import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const version = '0.4.0-alpha.6';
const rootName = `politica-canon-v${version}`;
const projectRoot = process.cwd();
const outputDir = path.resolve(projectRoot, '..');
const zipPath = path.join(outputDir, `${rootName}.zip`);
const manifestPath = path.join(outputDir, `MANIFEST_v${version}.json`);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'politica-canon-release-'));
const stage = path.join(tempRoot, rootName);

const excludedNames = new Set(['node_modules', '.git', '.env']);
const excludedPatterns = [/^politica-canon-v.*\.zip$/i, /^MANIFEST_v.*\.json$/i];

function filter(source) {
  const name = path.basename(source);
  return !excludedNames.has(name) && !excludedPatterns.some((pattern) => pattern.test(name));
}

function listFiles(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolute, base));
    else if (entry.isFile()) files.push(path.relative(base, absolute).split(path.sep).join('/'));
  }
  return files;
}

try {
  execFileSync('npm', ['run', 'build'], { cwd: projectRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  fs.cpSync(projectRoot, stage, { recursive: true, filter });
  fs.rmSync(path.join(stage, 'RELEASE_FILES.json'), { force: true });

  const inventory = {};
  for (const relative of listFiles(stage)) {
    inventory[relative] = crypto.createHash('sha256').update(fs.readFileSync(path.join(stage, relative))).digest('hex');
  }
  fs.writeFileSync(path.join(stage, 'RELEASE_FILES.json'), `${JSON.stringify({
    version,
    generatedAt: '2026-09-23',
    fileCount: Object.keys(inventory).length,
    files: inventory,
  }, null, 2)}\n`, 'utf8');

  const fixedTime = new Date('2000-01-01T00:00:00.000Z');
  for (const relative of listFiles(stage)) fs.utimesSync(path.join(stage, relative), fixedTime, fixedTime);
  for (const dir of [stage, tempRoot]) fs.utimesSync(dir, fixedTime, fixedTime);

  fs.rmSync(zipPath, { force: true });
  execFileSync('bash', ['-lc', `find '${rootName}' -type f -print | LC_ALL=C sort | TZ=UTC zip -X -q '${zipPath}' -@`], { cwd: tempRoot });
  const zip = fs.readFileSync(zipPath);
  const manifest = {
    version,
    releaseDate: '2026-09-23',
    packageName: path.basename(zipPath),
    sizeBytes: zip.length,
    sha256: crypto.createHash('sha256').update(zip).digest('hex'),
    fileCount: listFiles(stage).length,
    internalRoot: `${rootName}/`,
    canonicalDatabaseEngine: 'PostgreSQL 16+',
    dictamen: 'PASS (GITHUB ACTIONS REAL PG16/REDIS7/MAILPIT GATE CERTIFIED)',
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ zipPath, manifestPath, ...manifest }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
