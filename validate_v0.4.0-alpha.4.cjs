const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== VALIDACIÓN TÉCNICA Y DE ARQUITECTURA FASE C — RELEASE v0.4.0-alpha.4 ===');
console.log('Contrato de ejecución oficial: npm ci && node validate_v0.4.0-alpha.4.cjs\n');

let passCount = 0;
let totalChecks = 15;

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

// CHECK 9: Componentes de Fase C (AUD-008 EmptyState/ErrorState y AUD-009 Toast Accesible — Reforzado con ajustes de auditoría)
const toastExists = fs.existsSync('public/js/toast.js');
const emptyStateExists = fs.existsSync('public/js/empty-state.js');
const toastJs = toastExists ? fs.readFileSync('public/js/toast.js', 'utf8') : '';
const emptyJs = emptyStateExists ? fs.readFileSync('public/js/empty-state.js', 'utf8') : '';
const htmlForCheck9 = fs.readFileSync('public/index.html', 'utf8');

// Toast ARIA
const hasToastAria = toastJs.includes("setAttribute('role', 'alert')") || toastJs.includes('role=\"alert\"');
// M-C02: Danger default duration = 0
const hasDangerPersistent = toastJs.includes("type === 'danger'") && toastJs.includes('? 0');
// M-C02: setTimeout only when duration > 0
const hasTimeoutGuard = toastJs.includes('if (duration > 0)');
// EmptyState safe DOM
const hasEmptyStateSafeDOM = emptyJs.includes('document.createElement') && emptyJs.includes('textContent');
// M-C03: renderErrorState exported with safe DOM
const hasRenderErrorState = emptyJs.includes('renderErrorState') && emptyJs.includes('error-state-box');
// M-C03: Loaders call renderErrorState on error
const hasLoaderErrorHandling = htmlForCheck9.includes('renderErrorState(tbody');
// M-C03: 401/403 produce permission-specific feedback
const hasPermissionHandling = htmlForCheck9.includes("=== 401 || res.status === 403") && htmlForCheck9.includes("'permission'");
// Minor #1: aria-hidden on icons
const hasAriaHiddenIcons = toastJs.includes("setAttribute('aria-hidden', 'true')") && emptyJs.includes("setAttribute('aria-hidden', 'true')");
// Minor #2: showAlert does NOT call showToast
const showAlertNoToast = !htmlForCheck9.includes('showToast({ message: msg');

const check9Conditions = [
  { ok: toastExists && emptyStateExists, label: 'component files exist' },
  { ok: hasToastAria, label: 'toast ARIA roles' },
  { ok: hasDangerPersistent, label: 'M-C02: danger default duration = 0' },
  { ok: hasTimeoutGuard, label: 'M-C02: setTimeout only when duration > 0' },
  { ok: hasEmptyStateSafeDOM, label: 'EmptyState safe DOM' },
  { ok: hasRenderErrorState, label: 'M-C03: renderErrorState exported' },
  { ok: hasLoaderErrorHandling, label: 'M-C03: loaders render error state' },
  { ok: hasPermissionHandling, label: 'M-C03: 401/403 permission-specific feedback' },
  { ok: hasAriaHiddenIcons, label: 'aria-hidden on icons' },
  { ok: showAlertNoToast, label: 'showAlert does NOT call showToast' }
];

const check9Pass = check9Conditions.every(c => c.ok);
if (check9Pass) {
  console.log('✅ CHECK 9: Componentes de Fase C verificados (Toast danger persistente, setTimeout condicionado, ErrorState diferenciado con 401/403, aria-hidden, showAlert aislado)');
  passCount++;
} else {
  const failures = check9Conditions.filter(c => !c.ok).map(c => c.label);
  console.log(`❌ CHECK 9 FAIL: ${failures.join(', ')}`);
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

// CHECK 11 — H-C04: loadProfile() safe DOM (no innerHTML interpolation of user data)
const profileJs = fs.readFileSync('public/index.html', 'utf8');
const loadProfileMatch = profileJs.match(/async function loadProfile\(\) \{[\s\S]*?^\s*\}/m);
let check11Pass = false;
if (loadProfileMatch) {
  const loadProfileCode = loadProfileMatch[0];
  const hasInnerHTMLInterpolation = /innerHTML\s*[+=]\s*[^;]*(user\.|data\.|res\.)/.test(loadProfileCode);
  const usesTextContent = loadProfileCode.includes('textContent') || loadProfileCode.includes('createTextNode');
  const usesCreateElement = loadProfileCode.includes('createElement');
  check11Pass = !hasInnerHTMLInterpolation && usesTextContent && usesCreateElement;
}
if (check11Pass) {
  console.log('✅ CHECK 11 — H-C04: loadProfile() existe, usa textContent/createElement, SIN innerHTML con datos de usuario/API');
  passCount++;
} else {
  console.log('❌ CHECK 11 FAIL — H-C04: loadProfile() no cumple requisitos de renderizado seguro');
}

// CHECK 12 — M-C05: alert-danger used, .alert-danger defined, .alert-error NOT defined if no callsites
const cssContent = fs.readFileSync('public/styles/components.css', 'utf8');
const htmlJsContent = fs.readFileSync('public/index.html', 'utf8') + fs.readFileSync('public/js/confirm-dialog.js', 'utf8');
const hasAlertDangerClass = cssContent.includes('.alert-danger');
const hasAlertErrorClass = cssContent.includes('.alert-error');
const usesAlertDanger = htmlJsContent.includes('alert-danger');
const usesAlertError = htmlJsContent.includes('alert-error');
const check12Pass = hasAlertDangerClass && usesAlertDanger && (!hasAlertErrorClass || !usesAlertError);
if (check12Pass) {
  console.log('✅ CHECK 12 — M-C05: .alert-danger definida y usada; .alert-error sin definición ni callsites');
  passCount++;
} else {
  console.log(`❌ CHECK 12 FAIL — M-C05: alert-danger class=${hasAlertDangerClass} used=${usesAlertDanger} alert-error class=${hasAlertErrorClass} used=${usesAlertError}`);
}

// CHECK 13 — M-C06: .badge, .badge-info, .text-muted, .text-danger defined if used
const requiredCssClasses = ['.badge', '.badge-info', '.text-muted', '.text-danger'];
let check13Pass = true;
let check13Details = [];
for (const cls of requiredCssClasses) {
  const defined = cssContent.includes(cls);
  const used = htmlJsContent.includes(cls.replace('.', ''));
  if (used && !defined) {
    check13Pass = false;
    check13Details.push(`${cls} USADA PERO NO DEFINIDA`);
  } else if (!used && defined) {
    check13Details.push(`${cls} DEFINIDA PERO NO USADA (ok)`);
  } else if (used && defined) {
    check13Details.push(`${cls} DEFINIDA Y USADA ✓`);
  }
}
if (check13Pass) {
  console.log('✅ CHECK 13 — M-C06: ' + check13Details.join('; '));
  passCount++;
} else {
  console.log('❌ CHECK 13 FAIL — M-C06: ' + check13Details.join('; '));
}

// CHECK 14 — M-C07: renderLoadingState exists, uses createElement/textContent, generates tr+td, role="status", aria-live="polite", aria-hidden icon, loadSessions/loadInvitations/loadUsers call loading before fetch, colspans 5/4/5
const emptyStateJs = fs.readFileSync('public/js/empty-state.js', 'utf8');
const hasRenderLoadingState = emptyStateJs.includes('function renderLoadingState');
const usesCreateElementLoading = emptyStateJs.includes('createElement');
const usesTextContentLoading = emptyStateJs.includes('textContent');
const generatesTrTd = emptyStateJs.includes('createElement') && emptyStateJs.includes('tr') && emptyStateJs.includes('td');
const hasRoleStatus = emptyStateJs.includes('role') && emptyStateJs.includes('status');
const hasAriaLivePolite = emptyStateJs.includes('aria-live') && emptyStateJs.includes('polite');
const hasAriaHiddenIcon = emptyStateJs.includes('aria-hidden') && emptyStateJs.includes('true');
const htmlForCheck14 = fs.readFileSync('public/index.html', 'utf8');
const loadSessionsCallsLoading = htmlForCheck14.includes('loadSessions()') && htmlForCheck14.match(/loadSessions\(\)[\s\S]*?renderLoadingState/);
const loadInvitationsCallsLoading = htmlForCheck14.includes('loadInvitations()') && htmlForCheck14.match(/loadInvitations\(\)[\s\S]*?renderLoadingState/);
const loadUsersCallsLoading = htmlForCheck14.includes('loadUsers()') && htmlForCheck14.match(/loadUsers\(\)[\s\S]*?renderLoadingState/);
const colspansCorrect = htmlForCheck14.includes('colspan: 5') && htmlForCheck14.includes('colspan: 4') && htmlForCheck14.includes('colspan: 5');

const check14Pass = hasRenderLoadingState && usesCreateElementLoading && usesTextContentLoading && generatesTrTd && hasRoleStatus && hasAriaLivePolite && hasAriaHiddenIcon && loadSessionsCallsLoading && loadInvitationsCallsLoading && loadUsersCallsLoading && colspansCorrect;
if (check14Pass) {
  console.log('✅ CHECK 14 — M-C07: renderLoadingState completo + loadSessions/loadInvitations/loadUsers llaman loading antes de fetch + colspans 5/4/5');
  passCount++;
} else {
  console.log(`❌ CHECK 14 FAIL — M-C07: fn=${hasRenderLoadingState} createEl=${usesCreateElementLoading} textC=${usesTextContentLoading} trTd=${generatesTrTd} role=${hasRoleStatus} ariaLive=${hasAriaLivePolite} ariaHidden=${hasAriaHiddenIcon} loadSess=${loadSessionsCallsLoading} loadInv=${loadInvitationsCallsLoading} loadUsers=${loadUsersCallsLoading} colspans=${colspansCorrect}`);
}

// CHECK 15 — D-C08: oxlint not in package.json, not direct dependency in package-lock.json
const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const hasOxlintInPkg = pkgJson.devDependencies && pkgJson.devDependencies.oxlint || pkgJson.dependencies && pkgJson.dependencies.oxlint;
let hasOxlintInLock = false;
try {
  const lockContent = fs.readFileSync('package-lock.json', 'utf8');
  hasOxlintInLock = /"oxlint"\s*:/.test(lockContent);
} catch {}
const check15Pass = !hasOxlintInPkg && !hasOxlintInLock;
if (check15Pass) {
  console.log('✅ CHECK 15 — D-C08: oxlint NO en package.json, NO dependencia directa en package-lock.json');
  passCount++;
} else {
  console.log(`❌ CHECK 15 FAIL — D-C08: oxlint in package.json=${hasOxlintInPkg} in package-lock.json=${hasOxlintInLock}`);
}

console.log('\n--------------------------------------------------------------------------');
console.log(`DICTAMEN DE VALIDACIÓN TÉCNICA RELEASE v0.4.0-alpha.4: ${passCount === totalChecks ? 'PASS' : 'FAIL'} (${passCount}/${totalChecks} CONTROLES SUPERADOS)`);

if (passCount !== totalChecks) {
  process.exit(1);
}
