'use strict';

const { Router } = require('express');
const controller = require('../../controllers/reports.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { reportRequestSchema } = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

router.get('/', authorize('reports:read'), asyncHandler(controller.catalog));
router.get('/:report', authorize('reports:read'), validate(reportRequestSchema), asyncHandler(controller.generate));

module.exports = router;
