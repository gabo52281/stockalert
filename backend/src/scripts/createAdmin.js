#!/usr/bin/env node
'use strict';

/**
 * Crea (o actualiza) el primer administrador usando variables de entorno.
 * Nunca almacena credenciales en el repositorio.
 *
 * Variables: SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 */

const path = require('node:path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const env = require('../config/env');
const { query, closePool, runAsSystem } = require('../config/database');

(async () => {
  try {
    env.assertRuntimeConfig();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const name = process.env.SEED_ADMIN_NAME;
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error(
      'Defina SEED_ADMIN_NAME, SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en el .env de la raíz.',
    );
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres.');
    process.exitCode = 1;
    return;
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const establishmentId = Number(process.env.SEED_ADMIN_ESTABLISHMENT_ID || 1);
    const { rows } = await runAsSystem(() => query(
      `INSERT INTO users (name, email, password_hash, role_id, active, establishment_id, must_change_password)
       VALUES ($1, $2, $3, (SELECT id FROM roles WHERE name = 'ADMINISTRADOR'), TRUE, $4, TRUE)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             password_hash = EXCLUDED.password_hash,
             password_version = users.password_version + 1,
             must_change_password = TRUE,
             active = TRUE
       RETURNING id, email, establishment_id`,
      [name, email.toLowerCase(), hash, establishmentId],
    ));
    console.log(`Administrador listo: ${rows[0].email} (id ${rows[0].id})`);
  } catch (error) {
    console.error('No se pudo crear el administrador:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
})();
