import { spawn } from 'node:child_process';
import path from 'node:path';
import { ROOT_DIR, readRootEnv, resolveViteBin } from './env.mjs';

function run(script, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      env: { ...readRootEnv(), ...process.env },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Comando terminó con código ${code}: ${path.basename(script)}`));
    });
  });
}

async function main() {
  // En Vercel las variables llegan por entorno: las migraciones se aplican una
  // sola vez durante el build/despliegue, nunca por petición HTTP.
  const isDeploy = process.env.VERCEL === '1' || process.env.STOCKALERT_RUN_MIGRATIONS === '1';
  if (isDeploy) {
    console.log('Aplicando migraciones pendientes antes de compilar...');
    await run(path.join(ROOT_DIR, 'backend', 'src', 'scripts', 'migrate.js'), ['up'], ROOT_DIR);
  }

  console.log('Compilando frontend...');
  await run(resolveViteBin(), ['build'], path.join(ROOT_DIR, 'frontend'));
}

main().catch((error) => {
  console.error(`\nBuild fallido: ${error.message}\n`);
  process.exit(1);
});
