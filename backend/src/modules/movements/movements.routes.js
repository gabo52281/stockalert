'use strict';

const { Router } = require('express');
const controller = require('../../controllers/movements.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const {
  movementQuerySchema, movementInSchema, movementOutSchema, movementIdSchema,
} = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

router.get('/', authorize('movements:read'), validate(movementQuerySchema), asyncHandler(controller.list));
router.get('/:id', authorize('movements:read'), validate(movementIdSchema), asyncHandler(controller.get));
router.post('/in', authorize('movements:create'), validate(movementInSchema), asyncHandler(controller.entry));
router.post('/out', authorize('movements:create'), validate(movementOutSchema), asyncHandler(controller.exit));

module.exports = router;
