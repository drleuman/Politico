import { execSync } from 'child_process';

console.log('Esperando inicialización de Docker Engine...');
for (let i = 1; i <= 20; i++) {
  try {
    console.log(`[+] Intento ${i}/20: docker info`);
    execSync('docker info', { stdio: 'pipe' });
    console.log('\n✅ DOCKER ENGINE LISTO Y ACTIVO!');
    process.exit(0);
  } catch (err) {
    console.log('    Docker aún iniciando, esperando 3s...');
    execSync('powershell -Command "Start-Sleep -Seconds 3"', { stdio: 'pipe' });
  }
}
console.log('\n❌ Docker Engine no se inició a tiempo.');
process.exit(1);
