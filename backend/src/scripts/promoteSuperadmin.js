#!/usr/bin/env node
'use strict';

/**
 * Promueve EXPLÍCITAMENTE una cuenta existente a SUPERADMINISTRADOR.
 * No crea credenciales, no imprime secretos y NO modifica la contraseña.
 *
 * Uso:
 *   PROMOTE_SUPERADMIN_EMAIL=admin@su-dominio.com \
 *   CONFIRM_PROMOTE_SUPERADMIN=true npm run promote:superadmin
 */

const path = require('node:path');
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

  const email = process.env.PROMOTE_SUPERADMIN_EMAIL;
  const confirmed = process.env.CONFIRM_PROMOTE_SUPERADMIN === 'true';

  if (!email || !confirmed) {
    console.error('Defina PROMOTE_SUPERADMIN_EMAIL y CONFIRM_PROMOTE_SUPERADMIN=true para continuar.');
    process.exitCode = 1;
    return;
  }

  try {
    const { rows } = await runAsSystem(() => query(
      `UPDATE users
          SET role_id = (SELECT id FROM roles WHERE name = 'SUPERADMINISTRADOR'),
              establishment_id = NULL,
              active = TRUE
        WHERE lower(email) = lower($1)
        RETURNING id, email`,
      [email],
    ));
    if (!rows.length) {
      console.error('No existe una cuenta con ese correo.');
      process.exitCode = 1;
      return;
    }
    console.log(`Cuenta promovida a SUPERADMINISTRADOR: id ${rows[0].id}. Contraseña conservada.`);
  } catch (error) {
    console.error('No se pudo promover la cuenta:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
})();
