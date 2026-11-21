#!/usr/bin/env node
'use strict';

/**
 * El seed demostrativo quedó deshabilitado en la arquitectura multiempresa.
 * No crea usuarios, contraseñas ni datos de prueba: cada establecimiento se
 * crea desde el panel del superadministrador con un administrador asignado.
 */
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const ROOT = path.resolve(__dirname, '../../../');
const LEGACY_SEED_FILE = path.join(ROOT, 'database', 'seeds', '001_demo.sql');

console.error(
  'La carga demo ya no está disponible. ' +
  `El archivo ${path.relative(ROOT, LEGACY_SEED_FILE)} se conserva solo como referencia histórica; ` +
  'no debe ejecutarse en bases multiempresa. Use el panel de administración general para crear establecimientos y cuentas.',
);
process.exitCode = 1;
