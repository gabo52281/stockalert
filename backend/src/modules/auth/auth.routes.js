'use strict';

const { Router } = require('express');
const controller = require('../../controllers/auth.controller');
const { authenticate } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { authLimiter } = require('../../middlewares/rateLimiter');
const { loginSchema, changePasswordSchema } = require('../../validations/schemas');

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), asyncHandler(controller.login));
router.post('/logout', authenticate, asyncHandler(controller.logout));
router.get('/me', authenticate, asyncHandler(controller.me));
router.patch('/password', authenticate, validate(changePasswordSchema), asyncHandler(controller.changePassword));

module.exports = router;
