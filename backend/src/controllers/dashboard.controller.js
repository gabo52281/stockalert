'use strict';

const service = require('../services/dashboard.service');
const { ok } = require('../utils/pagination');

async function get(req, res) {
  return ok(res, await service.get(req.validated.query.days));
}

module.exports = { get };
