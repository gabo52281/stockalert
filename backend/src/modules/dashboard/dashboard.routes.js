'use strict';

const { Router } = require('express');
const controller = require('../../controllers/dashboard.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { dashboardQuerySchema } = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

router.get('/', authorize('dashboard:read'), validate(dashboardQuerySchema), asyncHandler(controller.get));

module.exports = router;
