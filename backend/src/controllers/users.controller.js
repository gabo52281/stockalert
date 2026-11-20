'use strict';

const service = require('../services/users.service');
const { parsePagination, buildMeta, ok } = require('../utils/pagination');

async function list(req, res) {
  const pagination = parsePagination(req.validated.query);
  const { rows, total } = await service.list({
    ...req.validated.query,
    ...pagination,
  });
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

async function resetPassword(req, res) {
  await service.resetPassword(req.validated.params.id, req.validated.body.password);
  return ok(res, { message: 'Contraseña restablecida' });
}

module.exports = { list, get, create, update, setActive, resetPassword };
