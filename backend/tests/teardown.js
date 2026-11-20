'use strict';

/** Cierra el pool compartido al terminar la suite completa. */
module.exports = async function teardown() {
  const { closePool } = require('../src/config/database');
  await closePool();
};
