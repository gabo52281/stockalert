import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import {
  ROOT_DIR,
  assertDevEnv,
  readRootEnv,
  resolveViteBin,
  rootEnvPath,
} from './env.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error(`\nSTOCKALERT no puede iniciarse:\n${message}\n`);
  process.exit(1);
}

if (!existsSync(rootEnvPath())) {
  fail('No existe el archivo .env en la raíz. Copie .env.example como .env y configure Neon.');
}

const rootEnv = readRootEnv();
try {
  assertDevEnv(rootEnv);
} catch (error) {
  fail(error.message);
}

const childEnv = { ...process.env, ...rootEnv };
const port = Number(childEnv.PORT) || 4000;
const webPort = 5173;
const children = [];

function run(script, args, cwd, name) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env: childEnv,
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    if (stopping) return;
    console.error(`\n${name} terminó inesperadamente (código ${code}).`);
    stop(code || 1);
  });
  children.push(child);
  return child;
}

async function waitFor(url, label, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`${label} listo en ${url}`);
        return;
      }
    } catch {
      // Todavía no está escuchando.
    }
    await delay(500);
  }
  throw new Error(`${label} no respondió en ${timeoutMs / 1000} segundos.`);
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      const opener = spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
      opener.unref();
    } else if (process.platform === 'darwin') {
      const opener = spawn('open', [url], { detached: true, stdio: 'ignore' });
      opener.unref();
    } else {
      const opener = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
      opener.unref();
    }
  } catch {
    console.log(`Abra manualmente: ${url}`);
  }
}

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

async function main() {
  console.log('Verificando configuración y aplicando migraciones pendientes...');
  const migration = spawn(
    process.execPath,
    [path.join(ROOT_DIR, 'backend', 'src', 'scripts', 'migrate.js'), 'up'],
    { cwd: ROOT_DIR, env: childEnv, stdio: 'inherit' },
  );
  const migrationCode = await new Promise((resolve) => migration.on('exit', resolve));
  if (migrationCode !== 0) throw new Error('Las migraciones no se pudieron aplicar. Revise DATABASE_URL y DIRECT_URL.');

  run(path.join(ROOT_DIR, 'backend', 'src', 'server.js'), [], ROOT_DIR, 'API');
  run(resolveViteBin(), ['--port', String(webPort)], path.join(ROOT_DIR, 'frontend'), 'WEB');

  await Promise.all([
    waitFor(`http://127.0.0.1:${port}/health`, 'API'),
    waitFor(`http://127.0.0.1:${webPort}/`, 'WEB'),
  ]);

  const url = `http://localhost:${webPort}`;
  console.log(`\nSTOCKALERT listo: ${url}`);
  openBrowser(url);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop(0));
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  stop(1);
});
