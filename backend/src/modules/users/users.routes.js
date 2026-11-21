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

router.get('/', authorize('users:read'), validate(userQuerySchema), asyncHandler(controller.list));
// Solo nombres del propio tenant: no expone correos, roles ni gestión de cuentas.
router.get('/options', authorize('movements:read', 'reports:read'), asyncHandler(controller.options));
router.get('/:id', authorize('users:read'), validate(userIdSchema), asyncHandler(controller.get));
router.post('/', authorize.requireRole('SUPERADMINISTRADOR'), validate(userCreateSchema), asyncHandler(controller.create));
router.patch('/:id', authorize.requireRole('SUPERADMINISTRADOR'), validate(userUpdateSchema), asyncHandler(controller.update));
router.patch('/:id/active', authorize.requireRole('SUPERADMINISTRADOR'), validate(activeToggleSchema), asyncHandler(controller.setActive));
router.patch('/:id/password', authorize.requireRole('SUPERADMINISTRADOR'), validate(resetPasswordSchema), asyncHandler(controller.resetPassword));

module.exports = router;
