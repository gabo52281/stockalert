'use strict';

const env = require('../config/env');
const ApiError = require('../utils/ApiError');

function mapDatabaseError(error) {
  switch (error.code) {
    case '23505':
      return ApiError.conflict('Ya existe un registro con ese valor único', 'DUPLICATE_VALUE');
    case '23503':
      return ApiError.badRequest('El registro referenciado no existe', 'FK_VIOLATION');
    case '23514':
      if (/INSUFFICIENT_STOCK|check constraint.*quantity/i.test(error.message)) {
        return ApiError.conflict('Stock insuficiente para realizar la salida', 'INSUFFICIENT_STOCK');
      }
      return ApiError.unprocessable('Restricción de integridad incumplida', 'CHECK_VIOLATION');
    case '22023':
      if (/INSUFFICIENT_STOCK/i.test(error.message)) {
        return ApiError.conflict('Stock insuficiente para realizar la salida', 'INSUFFICIENT_STOCK');
      }
      return ApiError.badRequest(error.message, 'INVALID_VALUE');
    case 'P0002':
      return ApiError.notFound('Producto no encontrado');
    default:
      return null;
  }
}

function notFoundHandler(_req, _res, next) {
  next(ApiError.notFound('Endpoint no encontrado'));
}

function errorHandler(error, _req, res, _next) {
  let normalized = error;

  if (!(error instanceof ApiError)) {
    normalized = mapDatabaseError(error) || new ApiError(500, 'INTERNAL_ERROR', 'Error interno del servidor');
  }

  if (error.name === 'ZodError' && !(error instanceof ApiError)) {
    normalized = ApiError.badRequest('Datos de entrada inválidos', error.flatten());
  }

  if (normalized.status >= 500 && env.NODE_ENV === 'production') {
    console.error('[ERROR]', error.message);
  }

  const body = {
    success: false,
    error: { code: normalized.code, message: normalized.message },
  };
  if (normalized.details) body.details = normalized.details;
  if (env.NODE_ENV !== 'production' && normalized.status >= 500) {
    body.debug = { name: error.name, message: error.message };
  }

  return res.status(normalized.status).json(body);
}

module.exports = { errorHandler, notFoundHandler };
