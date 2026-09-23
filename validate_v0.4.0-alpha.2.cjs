const fs = require('fs');
const path = require('path');

console.log('=== VALIDACIÓN TÉCNICA Y DE ARQUITECTURA FASE B — RELEASE v0.4.0-alpha.2 ===\n');

let passCount = 0;
let totalChecks = 8;

// CHECK 1: Versionado v0.4.0-alpha.2 en package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (pkg.version === '0.4.0-alpha.2') {
  console.log('✅ CHECK 1: Versionado correcto en package.json (0.4.0-alpha.2)');
  passCount++;
} else {
  console.log(`❌ CHECK 1 FAIL: package.json version es ${pkg.version}, se esperaba 0.4.0-alpha.2`);
}

// CHECK 2: Preservación de Artefactos Certificados Previos
if (fs.existsSync('politica-canon-v0.3.30.zip') && fs.existsSync('politica-canon-v0.4.0-alpha.1.zip')) {
  console.log('✅ CHECK 2: Artefactos de versiones previas intocados');
  passCount++;
} else {
  console.log('❌ CHECK 2 FAIL: Falta algún artefacto previo de versión zip');
}

// CHECK 3: Extracción Modular de Hojas de Estilo CSS en public/styles/
const styles = ['tokens.css', 'base.css', 'layout.css', 'components.css'];
const allStylesExist = styles.every(f => fs.existsSync(path.join('public', 'styles', f)));
if (allStylesExist) {
  console.log('✅ CHECK 3: Extracción modular de CSS (tokens, base, layout, components) en public/styles/');
  passCount++;
} else {
  console.log('❌ CHECK 3 FAIL: Faltan archivos de CSS en public/styles/');
}

// CHECK 4: ConfirmDialog Accesible WAI-ARIA (B1)
const confirmDialogExists = fs.existsSync('public/js/confirm-dialog.js');
const dialogJs = confirmDialogExists ? fs.readFileSync('public/js/confirm-dialog.js', 'utf8') : '';
const hasAriaModal = dialogJs.includes('role="dialog"') && dialogJs.includes('aria-modal="true"') && dialogJs.includes('aria-labelledby') && dialogJs.includes('aria-describedby');
const hasFocusTrap = dialogJs.includes('Tab') && dialogJs.includes('shiftKey') && dialogJs.includes('Escape');
if (confirmDialogExists && hasAriaModal && hasFocusTrap) {
  console.log('✅ CHECK 4: Componente ConfirmDialog con WAI-ARIA, modal semántico, Focus Trap y Escape verificado');
  passCount++;
} else {
  console.log('❌ CHECK 4 FAIL: ConfirmDialog no cumple los requisitos de accesibilidad WAI-ARIA');
}

// CHECK 5: No uso de window.confirm() en public/index.html (B1)
const htmlContent = fs.readFileSync('public/index.html', 'utf8');
const hasWindowConfirm = htmlContent.includes('window.confirm(') || htmlContent.includes('confirm(');
if (!hasWindowConfirm) {
  console.log('✅ CHECK 5: Cero invocaciones a window.confirm() en la interfaz');
  passCount++;
} else {
  console.log('❌ CHECK 5 FAIL: Se detectó uso no permitido de confirm() / window.confirm()');
}

// CHECK 6: Categorías de Layout Dinámico (B2)
const layoutCss = fs.readFileSync('public/styles/layout.css', 'utf8');
const hasLayoutCategories = layoutCss.includes('.layout-auth') && layoutCss.includes('.layout-content') && layoutCss.includes('.layout-settings') && layoutCss.includes('.layout-admin') && layoutCss.includes('.layout-data-heavy');
if (hasLayoutCategories) {
  console.log('✅ CHECK 6: Clases de layout por categoría (auth, content, settings, admin, data-heavy) en layout.css');
  passCount++;
} else {
  console.log('❌ CHECK 6 FAIL: Faltan categorías de layout semánticas en layout.css');
}

// CHECK 7: Design Tokens Semánticos Mínimos (B4)
const tokensCss = fs.readFileSync('public/styles/tokens.css', 'utf8');
const hasSemanticTokens = tokensCss.includes('--color-bg') && tokensCss.includes('--color-surface') && tokensCss.includes('--color-text-primary') && tokensCss.includes('--color-border') && tokensCss.includes('--color-danger') && tokensCss.includes('--color-focus');
if (hasSemanticTokens) {
  console.log('✅ CHECK 7: Tokens de diseño semánticos mínimos presentes en tokens.css');
  passCount++;
} else {
  console.log('❌ CHECK 7 FAIL: Faltan design tokens semánticos en tokens.css');
}

// CHECK 8: Sincronización dist/public/
const distHtmlExists = fs.existsSync('dist/public/index.html');
const distDialogExists = fs.existsSync('dist/public/js/confirm-dialog.js');
const distStylesExist = styles.every(f => fs.existsSync(path.join('dist', 'public', 'styles', f)));
if (distHtmlExists && distDialogExists && distStylesExist) {
  console.log('✅ CHECK 8: Compilación y sincronización en dist/public/ verificada');
  passCount++;
} else {
  console.log('❌ CHECK 8 FAIL: Archivos en dist/public/ no están sincronizados');
}

console.log('\n--------------------------------------------------------------------------');
console.log(`DICTAMEN DE VALIDACIÓN TÉCNICA RELEASE v0.4.0-alpha.2: ${passCount === totalChecks ? 'PASS' : 'FAIL'} (${passCount}/${totalChecks} CONTROLES SUPERADOS)`);

if (passCount !== totalChecks) {
  process.exit(1);
}
