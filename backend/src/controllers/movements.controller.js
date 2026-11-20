'use strict';

const service = require('../services/inventory.service');
const { parsePagination, buildMeta, ok } = require('../utils/pagination');

async function list(req, res) {
  const pagination = parsePagination(req.validated.query);
  const { rows, total } = await service.list({ ...req.validated.query, ...pagination });
  return ok(res, rows, buildMeta(total, pagination));
}

async function get(req, res) {
  return ok(res, await service.get(req.validated.params.id));
}

async function entry(req, res) {
  const result = await service.registerEntry(req.validated.body, req.user, req);
  return ok(res, result, null, 201);
}

async function exit(req, res) {
  const result = await service.registerExit(req.validated.body, req.user, req);
  return ok(res, result, null, 201);
}

module.exports = { list, get, entry, exit };
