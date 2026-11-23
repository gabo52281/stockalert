'use strict';

const path = require('node:path');
const { z } = require('zod');

// Único archivo de configuración del proyecto: stockalert/.env.
// En Vercel las variables llegan por entorno y este archivo no existe.
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const portSchema = z.coerce.number().int().min(1).max(65535);
const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  VERCEL: z.string().optional(),
  PORT: portSchema.default('4000'),
  DATABASE_URL: optionalUrl,
  DIRECT_URL: optionalUrl,
  DB_SSL: z.enum(['true', 'false']).default('false'),
  JWT_SECRET: z.string().min(16).optional(),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default('300'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default('900000'),
  OPENAI_API_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  OPENAI_MODEL: z.string().min(1).default('gpt-5.6-luna'),
  SEED_ADMIN_NAME: z.string().optional(),
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

/**
 * Validación usada solo al iniciar el servidor, ejecutar migraciones o hacer
 * deploy. Permite importar el app en pruebas unitarias sin exigir una BD real.
 */
function assertRuntimeConfig() {
  const errors = [];
  if (!env.DATABASE_URL) errors.push('DATABASE_URL es obligatoria (URL pooler de Neon).');
  if (!env.JWT_SECRET) errors.push('JWT_SECRET es obligatorio.');
  else if (env.JWT_SECRET.length < 32) errors.push('JWT_SECRET debe tener al menos 32 caracteres.');
  if (env.NODE_ENV === 'production' && env.CORS_ORIGIN.includes('localhost')) {
    errors.push('CORS_ORIGIN debe indicar el dominio real de producción.');
  }

  if (errors.length) {
    throw new Error(`Configuración incompleta:\n- ${errors.join('\n- ')}`);
  }
}

module.exports = env;
module.exports.assertRuntimeConfig = assertRuntimeConfig;
