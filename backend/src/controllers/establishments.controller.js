'use strict';

const service = require('../services/establishments.service');
const { parsePagination, buildMeta, ok } = require('../utils/pagination');

async function list(req, res) {
  const pagination = parsePagination(req.validated.query);
  const { rows, total } = await service.list({ ...req.validated.query, ...pagination }, req.user);
  return ok(res, rows, buildMeta(total, pagination));
}

async function get(req, res) {
  return ok(res, await service.get(req.validated.params.id, req.user));
}

async function create(req, res) {
  return ok(res, await service.create(req.validated.body, req.user), null, 201);
}

async function createWithAdmin(req, res) {
  return ok(res, await service.createWithAdmin(req.validated.body, req.user), null, 201);
}

async function update(req, res) {
  return ok(res, await service.update(req.validated.params.id, req.validated.body, req.user));
}

async function setActive(req, res) {
  return ok(res, await service.setActive(
    req.validated.params.id, req.validated.body.active, req.user,
  ));
}

async function usersFor(req, res) {
  return ok(res, await service.usersFor(req.validated.params.id, req.user));
}

async function stats(req, res) {
  return ok(res, await service.stats(req.user));
}

module.exports = {
  list, get, create, createWithAdmin, update, setActive, usersFor, stats,
};
