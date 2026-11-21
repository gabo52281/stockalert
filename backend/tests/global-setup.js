'use strict';

/**
 * Red de seguridad: las pruebas que escriben en BD solo pueden apuntar a una
 * base local/desechable. Ninguna prueba debe modificar Neon de producción.
 */
const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
const isLocal = !databaseUrl
  || /(^|@)(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(databaseUrl);

if (!isLocal && process.env.ALLOW_NONLOCAL_TESTS !== 'true') {
  throw new Error(
    'Las pruebas de integración están bloqueadas contra una base no local. '
    + 'Use una base desechable o defina ALLOW_NONLOCAL_TESTS=true de forma explícita.',
  );
}

module.exports = async () => {};
