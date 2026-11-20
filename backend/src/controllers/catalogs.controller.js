'use strict';

const service = require('../services/catalogs.service');
const { parsePagination, buildMeta, ok } = require('../utils/pagination');

// Categorías ---------------------------------------------------------------
async function listCategories(req, res) {
  const pagination = parsePagination(req.validated.query);
  const { rows, total } = await service.listCategories({ ...req.validated.query, ...pagination });
  return ok(res, rows, buildMeta(total, pagination));
}
async function getCategory(req, res) {
  return ok(res, await service.getCategory(req.validated.params.id));
}
async function createCategory(req, res) {
  return ok(res, await service.createCategory(req.validated.body), null, 201);
}
async function updateCategory(req, res) {
  return ok(res, await service.updateCategory(req.validated.params.id, req.validated.body));
}
async function setCategoryActive(req, res) {
  return ok(res, await service.setCategoryActive(req.validated.params.id, req.validated.body.active));
}
async function deleteCategory(req, res) {
  await service.deleteCategory(req.validated.params.id);
  return ok(res, { message: 'Categoría eliminada' });
}

// Proveedores --------------------------------------------------------------
async function listSuppliers(req, res) {
  const pagination = parsePagination(req.validated.query);
  const { rows, total } = await service.listSuppliers({ ...req.validated.query, ...pagination });
  return ok(res, rows, buildMeta(total, pagination));
}
async function getSupplier(req, res) {
  return ok(res, await service.getSupplier(req.validated.params.id));
}
async function createSupplier(req, res) {
  return ok(res, await service.createSupplier(req.validated.body), null, 201);
}
async function updateSupplier(req, res) {
  return ok(res, await service.updateSupplier(req.validated.params.id, req.validated.body));
}
async function setSupplierActive(req, res) {
  return ok(res, await service.setSupplierActive(req.validated.params.id, req.validated.body.active));
}
async function deleteSupplier(req, res) {
  await service.deleteSupplier(req.validated.params.id);
  return ok(res, { message: 'Proveedor eliminado' });
}
async function supplierProducts(req, res) {
  return ok(res, await service.supplierProducts(req.validated.params.id));
}

module.exports = {
  listCategories, getCategory, createCategory, updateCategory, setCategoryActive, deleteCategory,
  listSuppliers, getSupplier, createSupplier, updateSupplier, setSupplierActive,
  deleteSupplier, supplierProducts,
};
