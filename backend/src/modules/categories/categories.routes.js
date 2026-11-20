'use strict';

const { Router } = require('express');
const controller = require('../../controllers/catalogs.controller');
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const asyncHandler = require('../../utils/asyncHandler');
const {
  catalogQuerySchema, categoryCreateSchema, categoryUpdateSchema,
  activeToggleSchema, categoryIdSchema,
} = require('../../validations/schemas');

const router = Router();
router.use(authenticate);

router.get('/', authorize('categories:read'), validate(catalogQuerySchema), asyncHandler(controller.listCategories));
router.get('/:id', authorize('categories:read'), validate(categoryIdSchema), asyncHandler(controller.getCategory));
router.post('/', authorize('categories:create'), validate(categoryCreateSchema), asyncHandler(controller.createCategory));
router.patch('/:id', authorize('categories:update'), validate(categoryUpdateSchema), asyncHandler(controller.updateCategory));
router.patch('/:id/active', authorize('categories:deactivate'), validate(activeToggleSchema), asyncHandler(controller.setCategoryActive));
router.delete('/:id', authorize('categories:delete'), validate(categoryIdSchema), asyncHandler(controller.deleteCategory));

module.exports = router;
