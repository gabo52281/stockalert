'use strict';

const morgan = require('morgan');
const env = require('../config/env');

module.exports = env.NODE_ENV === 'test'
  ? (_req, _res, next) => next()
  : morgan(':method :url :status :response-time ms', {
      skip: (req) => req.path === '/health',
    });
