'use strict';

const repository = require('../repositories/analytics.repository');
const ApiError = require('../utils/ApiError');

async function summary() {
  return repository.alertSummary();
}

async function list(filters) {
  return repository.findAlerts(filters);
}

async function detail(productId) {
  const alert = await repository.alertDetail(productId);
  if (!alert) throw ApiError.notFound('Producto no encontrado');
  return alert;
}

module.exports = { summary, list, detail };
