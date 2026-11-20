'use strict';

const { Router } = require('express');
const controller = require('../../controllers/ai.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { aiQuerySchema } = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

router.get('/insights', authorize('indicators:read'), validate(aiQuerySchema), asyncHandler(controller.insights));

module.exports = router;
