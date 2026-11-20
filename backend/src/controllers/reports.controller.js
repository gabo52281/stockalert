'use strict';

const service = require('../services/reports.service');
const { ok } = require('../utils/pagination');

async function catalog(_req, res) {
  return ok(res, await service.catalog());
}

async function generate(req, res) {
  const { report } = req.validated.params;
  const filters = req.validated.query;
  const result = await service.exportReport(report, filters, filters.format);

  if (filters.format === 'json') return ok(res, result.data);

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(result.content);
}

module.exports = { catalog, generate };
