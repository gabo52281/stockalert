'use strict';

const repository = require('../repositories/analytics.repository');

async function summary(days) {
  return repository.indicatorsSummary(days);
}

async function coverage(filters) {
  return repository.coverageList(filters);
}

async function topProducts(days, limit) {
  return repository.topProducts(days, limit);
}

module.exports = { summary, coverage, topProducts };
