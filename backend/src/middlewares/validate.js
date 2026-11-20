'use strict';

const ApiError = require('../utils/ApiError');

/** Valida body, query y params con un esquema Zod y expone req.validated. */
module.exports = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body || {},
    query: req.query || {},
    params: req.params || {},
  });

  if (!result.success) {
    return next(ApiError.badRequest('Datos de entrada inválidos', result.error.flatten()));
  }

  req.validated = result.data;
  return next();
};
