#!/usr/bin/env node
'use strict';

/**
 * Ejecutor de migraciones versionadas.
 * Uso: node backend/src/scripts/migrate.js [up|down|status]
 * Las migraciones se ejecutan en una transacción y se registran en schema_migrations.
 */

const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { Pool } = require('pg');
const env = require('../config/env');
const { buildPoolConfig, directDatabaseUrl } = require('../config/poolConfig');

env.assertRuntimeConfig();

// Neon (y cualquier PgBouncer en modo transacción) requiere una conexión directa
// para DDL. Si no se define DIRECT_URL, se deriva de la URL pooler de Neon.
const migrationUrl = env.DIRECT_URL || directDatabaseUrl(env.DATABASE_URL);
const migrationPool = new Pool({ ...buildPoolConfig(migrationUrl), max: 1 });

function isLocalDatabase(url) {
  return /(^|@)(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url || '');
}

const command = process.argv[2] || 'up';
if (command !== 'status' && !isLocalDatabase(migrationUrl)
  && process.env.ALLOW_PRODUCTION_MIGRATION !== 'true') {
  throw new Error(
    'Este comando apunta a una base no local. Para aplicar cambios en producción '
    + 'se requiere autorización explícita: ALLOW_PRODUCTION_MIGRATION=true',
  );
}

const ROOT = path.resolve(__dirname, '../../../');
const MIGRATIONS_DIR = path.join(ROOT, 'database', 'migrations');
const MIGRATION_LOCK_ID = 742001;

function migrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.*\.sql$/.test(file))
    .sort();
}

async function ensureTable() {
  await migrationPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(80) PRIMARY KEY,
      filename    VARCHAR(180) NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function status() {
  await ensureTable();
  const { rows } = await migrationPool.query('SELECT version, applied_at FROM schema_migrations ORDER BY version');
  const applied = new Set(rows.map((r) => r.version));
  console.log('Migraciones:');
  for (const file of migrationFiles()) {
    const version = file.split('_')[0];
    console.log(`  [${applied.has(version) ? 'X' : ' '}] ${file}`);
  }
}

async function up() {
  // Evita que dos despliegues concurrentes apliquen la misma migración.
  await migrationPool.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
  try {
    await ensureTable();
    const { rows } = await migrationPool.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));
    let count = 0;

    for (const file of migrationFiles()) {
      const version = file.split('_')[0];
      if (applied.has(version)) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const client = await migrationPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)',
          [version, file],
        );
        await client.query('COMMIT');
        console.log(`Aplicada: ${file}`);
        count += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Error aplicando ${file}: ${error.message}`);
      } finally {
        client.release();
      }
    }

    console.log(count === 0 ? 'No hay migraciones pendientes.' : `${count} migración(es) aplicada(s).`);
  } finally {
    await migrationPool.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
  }
}

async function down() {
  await ensureTable();
  const { rows } = await migrationPool.query(
    'SELECT version, filename FROM schema_migrations ORDER BY version DESC LIMIT 1',
  );
  if (rows.length === 0) {
    console.log('No hay migraciones aplicadas.');
    return;
  }

  const { version, filename } = rows[0];
  const downFile = filename.replace(/\.sql$/, '.down.sql');
  const downPath = path.join(MIGRATIONS_DIR, downFile);

  if (!fs.existsSync(downPath)) {
    console.log(
      `La migración ${filename} no define ${downFile}. ` +
        'No se ejecuta revertido automático para evitar pérdida de datos.',
    );
    return;
  }

  const sql = fs.readFileSync(downPath, 'utf8');
  const client = await migrationPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
    await client.query('COMMIT');
    console.log(`Revertida: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

(async () => {
  const command = process.argv[2] || 'up';
  try {
    if (command === 'up') await up();
    else if (command === 'down') await down();
    else if (command === 'status') await status();
    else throw new Error(`Comando desconocido: ${command}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await migrationPool.end();
  }
})();
