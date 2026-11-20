'use strict';

const service = require('../services/products.service');
const movementsService = require('../services/inventory.service');
const { parsePagination, buildMeta, ok } = require('../utils/pagination');

async function list(req, res) {
  const pagination = parsePagination(req.validated.query);
  const { rows, total } = await service.list({ ...req.validated.query, ...pagination });
  return ok(res, rows, buildMeta(total, pagination));
}

async function get(req, res) {
  return ok(res, await service.get(req.validated.params.id));
}

async function create(req, res) {
  return ok(res, await service.create(req.validated.body), null, 201);
}

async function update(req, res) {
  return ok(res, await service.update(req.validated.params.id, req.validated.body));
}

async function setActive(req, res) {
  return ok(res, await service.setActive(req.validated.params.id, req.validated.body.active));
}

async function remove(req, res) {
  await service.remove(req.validated.params.id);
  return ok(res, { message: 'Producto eliminado' });
}

async function setAlertSettings(req, res) {
  return ok(res, await service.setAlertSettings(req.validated.params.id, req.validated.body));
}

async function history(req, res) {
  return ok(res, await movementsService.productHistory(req.validated.params.id));
}

module.exports = { list, get, create, update, setActive, remove, setAlertSettings, history };
