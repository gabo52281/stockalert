'use strict';

const app = require('./app');
const env = require('./config/env');
const { closePool } = require('./config/database');

try {
  env.assertRuntimeConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const server = app.listen(env.PORT, () => {
  console.log(`STOCKALERT API escuchando en http://localhost:${env.PORT}`);
  console.log(`Entorno: ${env.NODE_ENV}`);
});

function shutdown() {
  console.log('Cerrando servidor...');
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
