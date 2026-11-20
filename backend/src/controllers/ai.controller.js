'use strict';

const service = require('../services/ai.service');
const { ok } = require('../utils/pagination');

async function insights(req, res) {
  return ok(res, await service.insights(req.validated.query));
}

module.exports = { insights };
