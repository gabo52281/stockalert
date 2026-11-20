import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function rootEnvPath() {
  return path.join(ROOT_DIR, '.env');
}

/** Parser mínimo para el único archivo .env del proyecto. */
export function readRootEnv() {
  const filename = rootEnvPath();
  if (!existsSync(filename)) return {};

  const values = {};
  for (const rawLine of readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    values[match[1]] = value;
  }
  return values;
}

export function assertDevEnv(values) {
  const errors = [];
  if (!values.DATABASE_URL) errors.push('Falta DATABASE_URL (copie la URL pooler de Neon en .env).');
  if (!values.JWT_SECRET) errors.push('Falta JWT_SECRET (mínimo 32 caracteres aleatorios).');
  else if (values.JWT_SECRET.length < 32) errors.push('JWT_SECRET debe tener al menos 32 caracteres.');

  if (errors.length) {
    throw new Error(`Configuración incompleta:\n- ${errors.join('\n- ')}\n\nCopie .env.example como .env en la raíz y ajuste los valores.`);
  }
}

export function resolveViteBin() {
  const candidates = [
    path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js'),
    path.join(ROOT_DIR, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('No se encontró Vite. Ejecute npm install en la raíz.');
  return found;
}
