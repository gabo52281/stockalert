'use strict';

const ApiError = require('./ApiError');
const { isSuperAdmin } = require('../config/permissions');

/** Barrera de servicio para las operaciones exclusivas del superadministrador. */
function requireSuperAdmin(actor) {
  if (!isSuperAdmin(actor?.role)) {
    throw ApiError.forbidden('Esta sección es exclusiva del superadministrador');
  }
}

module.exports = requireSuperAdmin;
