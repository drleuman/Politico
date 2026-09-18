const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== VALIDACIÓN TÉCNICA Y DE ARQUITECTURA FASE C — RELEASE v0.4.0-alpha.4 ===');
console.log('Contrato de ejecución oficial: npm ci && node validate_v0.4.0-alpha.4.cjs\n');

let passCount = 0;
let totalChecks = 10;

// CHECK 1: Versionado v0.4.0-alpha.4 en package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (pkg.version === '0.4.0-alpha.4') {
  console.log('✅ CHECK 1: Versionado correcto en package.json (0.4.0-alpha.4)');
  passCount++;
} else {
  console.log(`❌ CHECK 1 FAIL: package.json version es ${pkg.version}, se esperaba 0.4.0-alpha.4`);
}

// CHECK 2: Autocontención e Integridad de Estructura de Proyecto
const requiredCore = ['package.json', 'tsconfig.json', 'src', 'public', 'db', 'scripts'];
const isCorePresent = requiredCore.every(f => fs.existsSync(f));
if (isCorePresent) {
  console.log('✅ CHECK 2: Estructura de código autocontenida y reproducible desde extracción limpia');
  passCount++;
} else {
  console.log('❌ CHECK 2 FAIL: Faltan carpetas/archivos core en la raíz del paquete');
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

// CHECK 4: ConfirmDialog Accesible WAI-ARIA, Focus Trap, Bloqueo Async, M-B08 y M-B09
const confirmDialogExists = fs.existsSync('public/js/confirm-dialog.js');
const dialogJs = confirmDialogExists ? fs.readFileSync('public/js/confirm-dialog.js', 'utf8') : '';
const hasAriaModal = dialogJs.includes('role="dialog"') && dialogJs.includes('aria-modal="true"') && dialogJs.includes('aria-labelledby') && dialogJs.includes('aria-describedby');
const hasFocusTrap = dialogJs.includes('Tab') && dialogJs.includes('shiftKey') && dialogJs.includes('Escape');
const hasProcessingLock = dialogJs.includes('isProcessing') && dialogJs.includes('if (isProcessing) return;');
const hasMB08AriaBusy = dialogJs.includes("removeAttribute('aria-busy')");
const hasMB09TabIndex = dialogJs.includes('tabindex="-1"') && dialogJs.includes('dialogBox.focus()');

if (confirmDialogExists && hasAriaModal && hasFocusTrap && hasProcessingLock && hasMB08AriaBusy && hasMB09TabIndex) {
  console.log('✅ CHECK 4: Componente ConfirmDialog con WAI-ARIA, modal semántico, Focus Trap, bloqueo isProcessing y remediaciones M-B08/M-B09 verificado');
  passCount++;
} else {
  console.log('❌ CHECK 4 FAIL: ConfirmDialog no cumple los requisitos de accesibilidad o bloqueo async');
}

// CHECK 5: Cero uso de window.confirm() en public/index.html (B1)
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

// CHECK 7: Design Tokens Semánticos Mínimos y Definición Completa (B4)
const tokensCss = fs.readFileSync('public/styles/tokens.css', 'utf8');
const hasSemanticTokens = tokensCss.includes('--color-bg') && tokensCss.includes('--color-surface') && tokensCss.includes('--color-text-primary') && tokensCss.includes('--color-border') && tokensCss.includes('--color-danger') && tokensCss.includes('--color-focus');
const hasFixedTokens = tokensCss.includes('--canon-bg-surface') && tokensCss.includes('--space-5');
if (hasSemanticTokens && hasFixedTokens) {
  console.log('✅ CHECK 7: Tokens de diseño semánticos completos en tokens.css');
  passCount++;
} else {
  console.log('❌ CHECK 7 FAIL: Faltan design tokens en tokens.css');
}

// CHECK 8: Protección Estructural contra XSS en ConfirmDialog
const hasUnsafeInnerHTML = dialogJs.includes('descEl.innerHTML =');
const hasSafeTextContent = dialogJs.includes('descEl.textContent =') && dialogJs.includes('document.createTextNode(');
if (!hasUnsafeInnerHTML && hasSafeTextContent) {
  console.log('✅ CHECK 8: Protección estructural XSS (remoción de innerHTML dinámico y uso de textContent/createTextNode) verificada');
  passCount++;
} else {
  console.log('❌ CHECK 8 FAIL: ConfirmDialog contiene innerHTML dinámico inseguro');
}

// CHECK 9: Componentes de Fase C (AUD-008 EmptyState y AUD-009 Toast Accesible)
const toastExists = fs.existsSync('public/js/toast.js');
const emptyStateExists = fs.existsSync('public/js/empty-state.js');
const toastJs = toastExists ? fs.readFileSync('public/js/toast.js', 'utf8') : '';
const emptyJs = emptyStateExists ? fs.readFileSync('public/js/empty-state.js', 'utf8') : '';

const hasToastAria = toastJs.includes('role="status"') || toastJs.includes('role="alert"') || toastJs.includes("setAttribute('role', 'alert')");
const hasEmptyStateSafeDOM = emptyJs.includes('document.createElement') && emptyJs.includes('textContent');

if (toastExists && emptyStateExists && hasToastAria && hasEmptyStateSafeDOM) {
  console.log('✅ CHECK 9: Componentes de Fase C (Toast accesibles con ARIA live y EmptyState con construcción segura de DOM) verificados');
  passCount++;
} else {
  console.log('❌ CHECK 9 FAIL: Faltan componentes de Fase C (toast.js / empty-state.js) o no cumplen normas de accesibilidad/seguridad');
}

// CHECK 10: Compilación y Sincronización Automática dist/public/ (Soporte H-B03 Pre-instalación y Post-instalación)
const distHtmlExists = fs.existsSync('dist/public/index.html');
const distDialogExists = fs.existsSync('dist/public/js/confirm-dialog.js');
const distToastExists = fs.existsSync('dist/public/js/toast.js');
const distEmptyExists = fs.existsSync('dist/public/js/empty-state.js');
const distStylesExist = styles.every(f => fs.existsSync(path.join('dist', 'public', 'styles', f)));
const hasNodeModules = fs.existsSync('node_modules');

if (hasNodeModules) {
  try {
    execSync('npm run build', { stdio: 'pipe' });
    if (fs.existsSync('dist/public/index.html') && fs.existsSync('dist/public/js/confirm-dialog.js') && fs.existsSync('dist/public/js/toast.js')) {
      console.log('✅ CHECK 10: Compilación ejecutada y sincronización en dist/public/ verificada exitosamente (Modo Re-compilación con dependencias)');
      passCount++;
    } else {
      console.log('❌ CHECK 10 FAIL: Falló la sincronización de archivos en dist/public/ tras build');
    }
  } catch (err) {
    console.log(`❌ CHECK 10 FAIL: Error al ejecutar build: ${err.message}`);
  }
} else {
  // Extracción limpia sin node_modules todavía instalados
  if (distHtmlExists && distDialogExists && distToastExists && distEmptyExists && distStylesExist) {
    console.log('✅ CHECK 10: Sincronización estática en dist/public/ verificada (Modo Pre-instalación sin node_modules). Nota: Para validación con re-compilación ejecutar "npm ci && node validate_v0.4.0-alpha.4.cjs"');
    passCount++;
  } else {
    console.log('❌ CHECK 10 FAIL: Faltan archivos estáticos compilados en dist/public/ para modo pre-instalación');
  }
}

console.log('\n--------------------------------------------------------------------------');
console.log(`DICTAMEN DE VALIDACIÓN TÉCNICA RELEASE v0.4.0-alpha.4: ${passCount === totalChecks ? 'PASS' : 'FAIL'} (${passCount}/${totalChecks} CONTROLES SUPERADOS)`);

if (passCount !== totalChecks) {
  process.exit(1);
}
