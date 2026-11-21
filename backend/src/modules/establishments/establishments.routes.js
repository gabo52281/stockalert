'use strict';

const { Router } = require('express');
const controller = require('../../controllers/establishments.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const {
  establishmentCreateSchema,
  establishmentUpdateSchema,
  establishmentQuerySchema,
  establishmentIdSchema,
  establishmentWithAdminSchema,
  activeToggleSchema,
} = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

router.get('/stats', authorize('admin-stats:read'), asyncHandler(controller.stats));
router.get('/', authorize('establishments:read'), validate(establishmentQuerySchema), asyncHandler(controller.list));
router.post('/', authorize.requireRole('SUPERADMINISTRADOR'), validate(establishmentCreateSchema), asyncHandler(controller.create));
router.post('/with-admin', authorize.requireRole('SUPERADMINISTRADOR'), validate(establishmentWithAdminSchema), asyncHandler(controller.createWithAdmin));
router.get('/:id', authorize('establishments:read'), validate(establishmentIdSchema), asyncHandler(controller.get));
router.get('/:id/users', authorize('users:read'), validate(establishmentIdSchema), asyncHandler(controller.usersFor));
router.patch('/:id', authorize.requireRole('SUPERADMINISTRADOR'), validate(establishmentUpdateSchema), asyncHandler(controller.update));
router.patch('/:id/active', authorize.requireRole('SUPERADMINISTRADOR'), validate(activeToggleSchema), asyncHandler(controller.setActive));

module.exports = router;
