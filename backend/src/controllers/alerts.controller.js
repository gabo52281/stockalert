'use strict';

const service = require('../services/alerts.service');
const { parsePagination, buildMeta, ok } = require('../utils/pagination');

async function summary(_req, res) {
  return ok(res, await service.summary());
}

async function list(req, res) {
  const pagination = parsePagination(req.validated.query);
  const { rows, total } = await service.list({ ...req.validated.query, ...pagination });
  return ok(res, rows, buildMeta(total, pagination));
}

async function detail(req, res) {
  return ok(res, await service.detail(req.validated.params.id));
}

module.exports = { summary, list, detail };
