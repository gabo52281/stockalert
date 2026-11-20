'use strict';

const repository = require('../repositories/analytics.repository');

module.exports = {
  get: (days) => repository.dashboard(days),
};
