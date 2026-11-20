'use strict';

const { Pool } = require('pg');
const { buildPoolConfig } = require('./poolConfig');

let pool;

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

async function query(text, params) {
  return getPool().query(text, params);
}

async function getClient() {
  return getPool().connect();
}

/** Ejecuta un callback dentro de una transacción con BEGIN/COMMIT/ROLLBACK. */
async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
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

module.exports = { getPool, query, getClient, transaction, closePool };
