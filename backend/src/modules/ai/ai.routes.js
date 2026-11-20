'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../../controllers/ai.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { aiQuerySchema, aiChatSchema } = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip || 'unknown'),
  handler: (_req, res) => res.status(429).json({
    success: false,
    error: {
      code: 'CHAT_RATE_LIMITED',
      message: 'Demasiadas preguntas en un minuto. Espera un momento y vuelve a intentarlo.',
    },
  }),
});

router.get('/insights', authorize('indicators:read'), validate(aiQuerySchema), asyncHandler(controller.insights));
router.get('/status', authorize('indicators:read'), asyncHandler(controller.status));
router.post('/chat', chatLimiter, authorize('indicators:read'), validate(aiChatSchema), asyncHandler(controller.chat));

module.exports = router;
