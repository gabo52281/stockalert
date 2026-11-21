'use strict';

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Solicitud inválida', detailsOrCode, details) {
    const code = typeof detailsOrCode === 'string' ? detailsOrCode : 'BAD_REQUEST';
    const extra = typeof detailsOrCode === 'string' ? details : detailsOrCode;
    return new ApiError(400, code, message, extra);
  }

  static unauthorized(message = 'Credenciales inválidas') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'No tiene permisos para esta operación') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Conflicto con el estado actual', code = 'CONFLICT') {
    return new ApiError(409, code, message);
  }

  static unprocessable(message = 'No se pudo procesar la operación', code = 'UNPROCESSABLE') {
    return new ApiError(422, code, message);
  }
}

module.exports = ApiError;
