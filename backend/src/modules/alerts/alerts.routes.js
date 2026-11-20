'use strict';

const { Router } = require('express');
const controller = require('../../controllers/alerts.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { alertQuerySchema, productIdSchema } = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

router.get('/summary', authorize('alerts:read'), asyncHandler(controller.summary));
router.get('/', authorize('alerts:read'), validate(alertQuerySchema), asyncHandler(controller.list));
router.get('/:id', authorize('alerts:read'), validate(productIdSchema), asyncHandler(controller.detail));

module.exports = router;
