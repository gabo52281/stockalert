'use strict';

const env = require('./env');

function isNeon(value) {
  return /neon\.tech/i.test(String(value || ''));
}

/**
 * La API usa siempre la URL pooler de Neon. Se fuerza TLS para Neon aunque la
 * cadena no incluya sslmode, y se mantiene un pool pequeño apto para serverless.
 */
function buildPoolConfig(connectionString = env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada. Copie .env.example como .env en la raíz.');
  }

  const needsSsl = isNeon(connectionString) || env.DB_SSL === 'true';
  return {
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: true } : false,
    max: 5,
    idleTimeoutMillis: 20000,
  };
}

/**
 * Neon recomienda la URL directa (sin -pooler) para DDL. Si solo se configura
 * la URL pooler, se deriva automáticamente.
 */
function directDatabaseUrl(url = env.DATABASE_URL) {
  if (!url || !isNeon(url)) return url || undefined;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('-pooler.')) {
      parsed.hostname = parsed.hostname.replace('-pooler.', '.');
      return parsed.toString();
    }
  } catch {
    // Si no se puede parsear, se usa la URL tal cual.
  }
  return url;
}

module.exports = { buildPoolConfig, directDatabaseUrl, isNeon };
