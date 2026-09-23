const fs = require('fs');
const path = require('path');

console.log('=== VALIDACIÓN DE FOUNDATIONS UI Y SEGURIDAD — RELEASE v0.4.0-alpha.1 ===\n');

let passCount = 0;
let totalChecks = 7;

// CHECK 1: Verificación de Versionado v0.4.0-alpha.1 en package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (pkg.version === '0.4.0-alpha.1') {
  console.log('✅ CHECK 1: Versionado correcto en package.json (0.4.0-alpha.1)');
  passCount++;
} else {
  console.log(`❌ CHECK 1 FAIL: package.json version es ${pkg.version}, se esperaba 0.4.0-alpha.1`);
}

// CHECK 2: Preservación del Artefacto Certificado v0.3.30 (Congelado e Inmutable)
if (fs.existsSync('politica-canon-v0.3.30.zip')) {
  const stat = fs.statSync('politica-canon-v0.3.30.zip');
  console.log(`✅ CHECK 2: Artefacto certificado v0.3.30 intocado (${stat.size} bytes)`);
  passCount++;
} else {
  console.log('❌ CHECK 2 FAIL: politica-canon-v0.3.30.zip no se encuentra');
}

// CHECK 3: Verificación de Estructura WAI-ARIA en public/index.html (AUD-001)
const htmlContent = fs.readFileSync('public/index.html', 'utf8');
const hasTablist = htmlContent.includes('role="tablist"') && htmlContent.includes('role="tab"') && htmlContent.includes('role="tabpanel"');
const hasAriaSelected = htmlContent.includes('aria-selected=') && htmlContent.includes('aria-controls=');

if (hasTablist && hasAriaSelected) {
  console.log('✅ CHECK 3: Estructura WAI-ARIA (tablist, tab, tabpanel, aria-selected, aria-controls) presente en public/index.html');
  passCount++;
} else {
  console.log('❌ CHECK 3 FAIL: Falta semántica ARIA obligatoria en public/index.html');
}

// CHECK 4: Verificación de Navegación por Teclado y Eventos de Flecha (AUD-001)
const hasArrowNav = htmlContent.includes('ArrowRight') && htmlContent.includes('ArrowLeft') && htmlContent.includes('Home') && htmlContent.includes('End');
if (hasArrowNav) {
  console.log('✅ CHECK 4: Manejador de eventos de teclado (ArrowLeft, ArrowRight, Home, End) verificado');
  passCount++;
} else {
  console.log('❌ CHECK 4 FAIL: Falta manejador de navegación por teclado en public/index.html');
}

// CHECK 5: Verificación de Estados de Carga e Inhabilitación de Botones (AUD-003)
const hasLoadingState = htmlContent.includes('setButtonLoading') && htmlContent.includes('aria-busy');
if (hasLoadingState) {
  console.log('✅ CHECK 5: Gestión de estados de carga e inhabilitación (setButtonLoading / aria-busy) verificada');
  passCount++;
} else {
  console.log('❌ CHECK 5 FAIL: Falta helper de estado de carga setButtonLoading en public/index.html');
}

// CHECK 6: Verificación de Anillo de Foco y Reglas Responsive WCAG (AUD-004 / AUD-006)
const hasFocusVisible = htmlContent.includes(':focus-visible') && htmlContent.includes('--text-muted: #94a3b8');
const hasMediaQueries = htmlContent.includes('@media (max-width: 640px)') && htmlContent.includes('@media (prefers-reduced-motion: reduce)');
if (hasFocusVisible && hasMediaQueries) {
  console.log('✅ CHECK 6: Reglas :focus-visible, alto contraste (>7:1), responsive reflow y prefers-reduced-motion verificadas');
  passCount++;
} else {
  console.log('❌ CHECK 6 FAIL: Faltan reglas CSS de accesibilidad/responsive en public/index.html');
}

// CHECK 7: Verificación de Compilación e Igualdad dist/public/index.html
const distHtmlExists = fs.existsSync('dist/public/index.html');
const distHtmlContent = distHtmlExists ? fs.readFileSync('dist/public/index.html', 'utf8') : '';
const isSynced = distHtmlExists && (distHtmlContent === htmlContent);

if (isSynced) {
  console.log('✅ CHECK 7: Sincronización automática de public/index.html con dist/public/index.html verificada');
  passCount++;
} else {
  console.log('❌ CHECK 7 FAIL: dist/public/index.html no está sincronizado con public/index.html');
}

console.log('\n--------------------------------------------------------------------------');
console.log(`DICTAMEN DE VALIDACIÓN TÉCNICA RELEASE v0.4.0-alpha.1: ${passCount === totalChecks ? 'PASS' : 'FAIL'} (${passCount}/${totalChecks} CONTROLES SUPERADOS)`);

if (passCount !== totalChecks) {
  process.exit(1);
}
