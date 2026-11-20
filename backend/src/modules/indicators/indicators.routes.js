'use strict';

const { Router } = require('express');
const controller = require('../../controllers/metrics.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { indicatorQuerySchema } = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

router.get('/summary', authorize('indicators:read'), validate(indicatorQuerySchema), asyncHandler(controller.summary));
router.get('/coverage', authorize('indicators:read'), validate(indicatorQuerySchema), asyncHandler(controller.coverage));
router.get('/top-products', authorize('indicators:read'), validate(indicatorQuerySchema), asyncHandler(controller.topProducts));

module.exports = router;
