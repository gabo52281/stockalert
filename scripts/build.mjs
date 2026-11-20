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
  // En Vercel Services cada servicio compila por separado: las migraciones las
  // ejecuta el build del servicio backend. Este script solo compila la SPA.
  console.log('Compilando frontend...');
  await run(resolveViteBin(), ['build'], path.join(ROOT_DIR, 'frontend'));
}

main().catch((error) => {
  console.error(`\nBuild fallido: ${error.message}\n`);
  process.exit(1);
});
