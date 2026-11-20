'use strict';

const { Router } = require('express');
const controller = require('../../controllers/products.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const {
  productQuerySchema, productIdSchema, productCreateSchema, productUpdateSchema,
  activeToggleSchema, alertSettingsSchema,
} = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

router.get('/', authorize('products:read'), validate(productQuerySchema), asyncHandler(controller.list));
router.get('/:id', authorize('products:read'), validate(productIdSchema), asyncHandler(controller.get));
router.get('/:id/movements', authorize('products:read'), validate(productIdSchema), asyncHandler(controller.history));
router.post('/', authorize('products:create'), validate(productCreateSchema), asyncHandler(controller.create));
router.patch('/:id', authorize('products:update'), validate(productUpdateSchema), asyncHandler(controller.update));
router.patch('/:id/active', authorize('products:deactivate'), validate(activeToggleSchema), asyncHandler(controller.setActive));
router.patch('/:id/alert-settings', authorize('products:update'), validate(alertSettingsSchema), asyncHandler(controller.setAlertSettings));
router.delete('/:id', authorize('products:delete'), validate(productIdSchema), asyncHandler(controller.remove));

module.exports = router;
