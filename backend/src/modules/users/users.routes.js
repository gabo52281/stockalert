'use strict';

const { Router } = require('express');
const controller = require('../../controllers/users.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const {
  userQuerySchema, userIdSchema, userCreateSchema, userUpdateSchema,
  activeToggleSchema, resetPasswordSchema,
} = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

router.get('/', authorize('profile:read'), validate(userQuerySchema), asyncHandler(controller.list));
router.get('/:id', authorize('profile:read'), validate(userIdSchema), asyncHandler(controller.get));
router.post('/', authorize.requireRole('ADMINISTRADOR'), validate(userCreateSchema), asyncHandler(controller.create));
router.patch('/:id', authorize.requireRole('ADMINISTRADOR'), validate(userUpdateSchema), asyncHandler(controller.update));
router.patch('/:id/active', authorize.requireRole('ADMINISTRADOR'), validate(activeToggleSchema), asyncHandler(controller.setActive));
router.patch('/:id/password', authorize.requireRole('ADMINISTRADOR'), validate(resetPasswordSchema), asyncHandler(controller.resetPassword));

module.exports = router;
