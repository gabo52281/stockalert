'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const env = require('./config/env');
const { query } = require('./config/database');
const requestLogger = require('./middlewares/requestLogger');
const { generalLimiter } = require('./middlewares/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const asyncHandler = require('./utils/asyncHandler');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const suppliersRoutes = require('./modules/suppliers/suppliers.routes');
const productsRoutes = require('./modules/products/products.routes');
const movementsRoutes = require('./modules/movements/movements.routes');
const alertsRoutes = require('./modules/alerts/alerts.routes');
const indicatorsRoutes = require('./modules/indicators/indicators.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const aiRoutes = require('./modules/ai/ai.routes');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(compression());
app.use(requestLogger);
app.use(generalLimiter);

app.get('/health', asyncHandler(async (_req, res) => {
  try {
    await query('SELECT 1');
    return res.json({ success: true, status: 'ok', database: 'connected' });
  } catch {
    return res.status(503).json({ success: false, status: 'degraded', database: 'disconnected' });
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/movements', movementsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/indicators', indicatorsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/ia', aiRoutes);

// En producción local el mismo proceso sirve la SPA compilada. En Vercel los
// archivos estáticos los sirve la plataforma y esta función solo responde /api.
if (env.NODE_ENV === 'production' && !env.VERCEL) {
  const frontendDir = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir, { index: false, maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path === '/health' || req.path === '/api' || req.path.startsWith('/api/')) return next();
      return res.sendFile(path.join(frontendDir, 'index.html'));
    });
  }
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
