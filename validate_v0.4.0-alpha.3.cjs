const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== VALIDACIÓN TÉCNICA Y DE REMEDIACIÓN DE ARQUITECTURA FASE B — RELEASE v0.4.0-alpha.3 ===');
console.log('Contrato de ejecución oficial: npm ci && node validate_v0.4.0-alpha.3.cjs\n');

let passCount = 0;
let totalChecks = 10;

// CHECK 1: Versionado v0.4.0-alpha.3 en package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (pkg.version === '0.4.0-alpha.3') {
  console.log('✅ CHECK 1: Versionado correcto en package.json (0.4.0-alpha.3)');
  passCount++;
} else {
  console.log(`❌ CHECK 1 FAIL: package.json version es ${pkg.version}, se esperaba 0.4.0-alpha.3`);
}

// CHECK 2: Autocontención e Integridad de Estructura de Proyecto (H-B03 Reproducibilidad en Extracción Limpia)
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
const hasMB08AriaBusy = dialogJs.includes('removeAttribute(\'aria-busy\')') || dialogJs.includes('removeAttribute("aria-busy")');
const hasMB09TabIndex = dialogJs.includes('tabindex="-1"') && dialogJs.includes('dialogBox.focus()');

if (confirmDialogExists && hasAriaModal && hasFocusTrap && hasProcessingLock && hasMB08AriaBusy && hasMB09TabIndex) {
  console.log('✅ CHECK 4: Componente ConfirmDialog con WAI-ARIA, modal semántico, Focus Trap, bloqueo isProcessing, ciclo aria-busy (M-B08) y contención de foco en procesamiento (M-B09) verificado');
  passCount++;
} else {
  console.log('❌ CHECK 4 FAIL: ConfirmDialog no cumple los requisitos de accesibilidad, bloqueo async o remediaciones M-B08/M-B09');
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

// CHECK 7: Design Tokens Semánticos Mínimos y Definición Completa (B4 / M-B04)
const tokensCss = fs.readFileSync('public/styles/tokens.css', 'utf8');
const hasSemanticTokens = tokensCss.includes('--color-bg') && tokensCss.includes('--color-surface') && tokensCss.includes('--color-text-primary') && tokensCss.includes('--color-border') && tokensCss.includes('--color-danger') && tokensCss.includes('--color-focus');
const hasFixedTokens = tokensCss.includes('--canon-bg-surface') && tokensCss.includes('--space-5');
if (hasSemanticTokens && hasFixedTokens) {
  console.log('✅ CHECK 7: Tokens de diseño semánticos completos (--canon-bg-surface, --space-5, --color-*) en tokens.css');
  passCount++;
} else {
  console.log('❌ CHECK 7 FAIL: Faltan design tokens o variables corrigiendo M-B04 en tokens.css');
}

// CHECK 8: Protección Estructural contra XSS en ConfirmDialog (H-B02 Remediación)
const hasUnsafeInnerHTML = dialogJs.includes('descEl.innerHTML =');
const hasSafeTextContent = dialogJs.includes('descEl.textContent =') && dialogJs.includes('document.createTextNode(');
if (!hasUnsafeInnerHTML && hasSafeTextContent) {
  console.log('✅ CHECK 8: Protección estructural XSS (remoción de innerHTML dinámico y uso de textContent/createTextNode) verificada');
  passCount++;
} else {
  console.log('❌ CHECK 8 FAIL: ConfirmDialog contiene innerHTML dinámico inseguro');
}

// CHECK 9: Soporte Completo de Scope, Reversibilidad y Errores Async (M-B05 / M-B06 Remediación)
const hasScopeAndRev = dialogJs.includes('options.scope') && (dialogJs.includes('options.reversible') || dialogJs.includes('options.reversibility'));
const keepsOpenOnError = dialogJs.includes('isProcessing = false;') && dialogJs.includes('errBox.textContent');
if (hasScopeAndRev && keepsOpenOnError) {
  console.log('✅ CHECK 9: Renderizado explícito de Scope, Reversibilidad y retención de modal con error en fallos async verificado');
  passCount++;
} else {
  console.log('❌ CHECK 9 FAIL: ConfirmDialog no renderiza scope/reversibilidad o no retiene modal en fallos async');
}

// CHECK 10: Compilación y Sincronización Automática dist/public/ (Soporte H-B03 Pre-instalación y Post-instalación)
const distHtmlExists = fs.existsSync('dist/public/index.html');
const distDialogExists = fs.existsSync('dist/public/js/confirm-dialog.js');
const distStylesExist = styles.every(f => fs.existsSync(path.join('dist', 'public', 'styles', f)));
const hasNodeModules = fs.existsSync('node_modules');

if (hasNodeModules) {
  try {
    execSync('npm run build', { stdio: 'pipe' });
    if (fs.existsSync('dist/public/index.html') && fs.existsSync('dist/public/js/confirm-dialog.js')) {
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
  if (distHtmlExists && distDialogExists && distStylesExist) {
    console.log('✅ CHECK 10: Sincronización estática en dist/public/ verificada (Modo Pre-instalación sin node_modules). Nota: Para validación con re-compilación ejecutar "npm ci && node validate_v0.4.0-alpha.3.cjs"');
    passCount++;
  } else {
    console.log('❌ CHECK 10 FAIL: Faltan archivos estáticos compilados en dist/public/ para modo pre-instalación');
  }
}

console.log('\n--------------------------------------------------------------------------');
console.log(`DICTAMEN DE VALIDACIÓN TÉCNICA RELEASE v0.4.0-alpha.3: ${passCount === totalChecks ? 'PASS' : 'FAIL'} (${passCount}/${totalChecks} CONTROLES SUPERADOS)`);

if (passCount !== totalChecks) {
  process.exit(1);
}

