'use strict';

// Punto de entrada del servicio Express en Vercel Services.
// No importa src/server.js: allí sí se llama a app.listen() para el desarrollo local.
module.exports = require('../src/app');
