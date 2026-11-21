'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const { Pool } = require('pg');
const { buildPoolConfig } = require('./poolConfig');

let pool;

/** Contexto de petición: nunca se toma del cliente, solo de la sesión validada. */
const tenantStorage = new AsyncLocalStorage();

function runWithContext(context, callback) {
  return tenantStorage.run(context || {}, callback);
}

function runAsSystem(callback, establishmentId = null) {
  return runWithContext({ role: 'SYSTEM', establishmentId }, callback);
}

function currentContext() {
  return tenantStorage.getStore() || {};
}

/** El pool se crea bajo demanda para no abrir conexiones al importar módulos. */
function getPool() {
  if (!pool) {
    pool = new Pool(buildPoolConfig());
    pool.on('error', (error) => {
      console.error('Error inesperado del pool de PostgreSQL:', error.message);
    });
  }
  return pool;
}

async function applyContext(client) {
  const { role = '', establishmentId = null } = currentContext();
  await client.query(
    `SELECT set_config('app.current_role', $1, true),
            set_config('app.current_establishment_id', $2, true)`,
    [String(role || ''), establishmentId == null ? '' : String(establishmentId)],
  );
}

/**
 * Toda consulta usa una conexión reservada mientras se configura el contexto y
 * se ejecuta la sentencia. Así dos peticiones concurrentes nunca comparten GUC.
 */
async function query(text, params) {
  const client = await getPool().connect();
  try {
    // BEGIN + SET LOCAL garantiza que el GUC nunca quede pegado en la conexión
    // del pool cuando se libera, incluso si otra petición usa el mismo cliente.
    await client.query('BEGIN');
    await applyContext(client);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getClient() {
  return getPool().connect();
}

/** Ejecuta un callback dentro de una transacción con BEGIN/COMMIT/ROLLBACK. */
async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { role = '', establishmentId = null } = currentContext();
    await client.query(
      `SELECT set_config('app.current_role', $1, true),
              set_config('app.current_establishment_id', $2, true)`,
      [String(role || ''), establishmentId == null ? '' : String(establishmentId)],
    );
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}

module.exports = {
  getPool,
  query,
  getClient,
  transaction,
  closePool,
  runWithContext,
  runAsSystem,
  currentContext,
};
