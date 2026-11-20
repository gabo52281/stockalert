'use strict';

const service = require('../services/metrics.service');
const { parsePagination, buildMeta, ok } = require('../utils/pagination');

async function summary(req, res) {
  return ok(res, await service.summary(req.validated.query.days));
}

async function coverage(req, res) {
  const pagination = parsePagination(req.validated.query);
  const { rows, total } = await service.coverage({ ...req.validated.query, ...pagination });
  return ok(res, rows, buildMeta(total, pagination));
}

async function topProducts(req, res) {
  return ok(res, await service.topProducts(req.validated.query.days, req.validated.query.limit));
}

module.exports = { summary, coverage, topProducts };
