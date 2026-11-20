#!/usr/bin/env node
'use strict';

/**
 * Carga de datos DEMOSTRATIVOS (nunca para producción).
 * Uso: node backend/src/scripts/seed.js
 * La contraseña demo se toma de DEMO_PASSWORD (por defecto Demo1234!) y se
 * almacena únicamente como hash bcrypt calculado en tiempo de ejecución.
 */

const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const env = require('../config/env');
const { transaction, closePool } = require('../config/database');

const ROOT = path.resolve(__dirname, '../../../');
const SEED_FILE = path.join(ROOT, 'database', 'seeds', '001_demo.sql');

(async () => {
  if (env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('La carga demo está bloqueada en producción. Use ALLOW_DEMO_SEED=true solo en un entorno desechable.');
    process.exitCode = 1;
    return;
  }
  try {
    env.assertRuntimeConfig();
    const password = process.env.DEMO_PASSWORD || 'Demo1234!';
    const hash = await bcrypt.hash(password, 12);
    const sql = fs
      .readFileSync(SEED_FILE, 'utf8')
      .replaceAll('{{DEMO_HASH}}', hash);

    const demoMovements = await transaction(async (client) => {
      await client.query(sql);
      const { rows } = await client.query("SELECT count(*)::int AS n FROM inventory_movements WHERE source_key LIKE 'DEMO-%'");
      return rows[0].n;
    });

    console.log('Datos demostrativos cargados (idempotente).');
    console.log(`Movimientos demo presentes: ${demoMovements}`);
    console.log(`Usuarios demo: admin@ / encargado@ / consulta@stockalert.local — contraseña: ${password}`);
    console.log('ADVERTENCIA: estos datos son SOLO demostrativos. No usar en producción.');
  } catch (error) {
    console.error('Error cargando datos demo:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
})();
