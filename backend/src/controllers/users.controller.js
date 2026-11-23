'use strict';

const service = require('../services/users.service');
const { parsePagination, buildMeta, ok } = require('../utils/pagination');

async function list(req, res) {
  const pagination = parsePagination(req.validated.query);
  const { rows, total } = await service.list({
    ...req.validated.query,
    ...pagination,
  }, req.user);
  return ok(res, rows, buildMeta(total, pagination));
}

async function options(req, res) {
  return ok(res, await service.options(req.user));
}

async function get(req, res) {
  return ok(res, await service.get(req.validated.params.id, req.user));
}

async function create(req, res) {
  return ok(res, await service.create(req.validated.body, req.user), null, 201);
}

async function update(req, res) {
  return ok(res, await service.update(req.validated.params.id, req.validated.body, req.user));
}

async function setActive(req, res) {
  return ok(res, await service.setActive(
    req.validated.params.id, req.validated.body.active, req.user,
  ));
}

async function resetPassword(req, res) {
  await service.resetPassword(
    req.validated.params.id, req.validated.body.password, req.user,
  );
  return ok(res, { message: 'Contraseña restablecida. Se cerraron las sesiones anteriores.' });
}

module.exports = { list, options, get, create, update, setActive, resetPassword };
