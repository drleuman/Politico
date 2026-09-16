const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../public');
const destDir = path.resolve(__dirname, '../dist/public');

if (fs.existsSync(srcDir)) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
  console.log('[BUILD] Static assets copied to dist/public successfully.');
}
