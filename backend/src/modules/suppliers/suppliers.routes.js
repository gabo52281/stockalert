'use strict';

const { Router } = require('express');
const controller = require('../../controllers/catalogs.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const {
  catalogQuerySchema, supplierCreateSchema, supplierUpdateSchema,
  activeToggleSchema, supplierIdSchema,
} = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

router.get('/', authorize('suppliers:read'), validate(catalogQuerySchema), asyncHandler(controller.listSuppliers));
router.get('/:id', authorize('suppliers:read'), validate(supplierIdSchema), asyncHandler(controller.getSupplier));
router.get('/:id/products', authorize('suppliers:read'), validate(supplierIdSchema), asyncHandler(controller.supplierProducts));
router.post('/', authorize('suppliers:create'), validate(supplierCreateSchema), asyncHandler(controller.createSupplier));
router.patch('/:id', authorize('suppliers:update'), validate(supplierUpdateSchema), asyncHandler(controller.updateSupplier));
router.patch('/:id/active', authorize('suppliers:deactivate'), validate(activeToggleSchema), asyncHandler(controller.setSupplierActive));
router.delete('/:id', authorize('suppliers:delete'), validate(supplierIdSchema), asyncHandler(controller.deleteSupplier));

module.exports = router;
