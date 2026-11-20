'use strict';

const ApiError = require('../utils/ApiError');
const { can } = require('../config/permissions');

/** authorize('products:create', 'products:update') → basta con uno de ellos. */
const authorize = (...permissions) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  const allowed = permissions.some((permission) => can(req.user.role, permission));
  if (!allowed) {
    return next(ApiError.forbidden('Su rol no permite realizar esta operación'));
  }
  return next();
};

authorize.requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('Esta operación requiere un rol superior'));
  }
  return next();
};

module.exports = authorize;
