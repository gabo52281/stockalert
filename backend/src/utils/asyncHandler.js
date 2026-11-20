'use strict';

/** Envuelve controladores async y reenvía errores al middleware centralizado. */
module.exports = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
