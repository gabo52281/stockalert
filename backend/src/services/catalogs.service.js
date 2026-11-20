'use strict';

const repository = require('../repositories/catalogs.repository');
const ApiError = require('../utils/ApiError');

// Categorías ---------------------------------------------------------------
async function listCategories(filters) {
  return repository.findCategories(filters);
}
async function getCategory(id) {
  const category = await repository.findCategoryById(id);
  if (!category) throw ApiError.notFound('Categoría no encontrada');
  return category;
}
async function createCategory(data) {
  return repository.createCategory(data);
}
async function updateCategory(id, fields) {
  await getCategory(id);
  return repository.updateCategory(id, fields);
}
async function setCategoryActive(id, active) {
  await getCategory(id);
  return repository.updateCategory(id, { active });
}
async function deleteCategory(id) {
  await getCategory(id);
  if (await repository.categoryHasProducts(id)) {
    throw ApiError.conflict(
      'La categoría tiene productos asociados. Desactívela o reasigne los productos.',
      'CATEGORY_HAS_PRODUCTS',
    );
  }
  await repository.deleteCategory(id);
}

// Proveedores --------------------------------------------------------------
async function listSuppliers(filters) {
  return repository.findSuppliers(filters);
}
async function getSupplier(id) {
  const supplier = await repository.findSupplierById(id);
  if (!supplier) throw ApiError.notFound('Proveedor no encontrado');
  return supplier;
}
async function createSupplier(data) {
  return repository.createSupplier(data);
}
async function updateSupplier(id, fields) {
  await getSupplier(id);
  return repository.updateSupplier(id, fields);
}
async function setSupplierActive(id, active) {
  await getSupplier(id);
  return repository.updateSupplier(id, { active });
}
async function deleteSupplier(id) {
  await getSupplier(id);
  if (await repository.supplierHasProducts(id)) {
    throw ApiError.conflict(
      'El proveedor tiene productos asociados. Desactívelo o reasigne los productos.',
      'SUPPLIER_HAS_PRODUCTS',
    );
  }
  await repository.deleteSupplier(id);
}
async function supplierProducts(id) {
  await getSupplier(id);
  return repository.supplierProducts(id);
}

module.exports = {
  listCategories, getCategory, createCategory, updateCategory, setCategoryActive, deleteCategory,
  listSuppliers, getSupplier, createSupplier, updateSupplier, setSupplierActive,
  deleteSupplier, supplierProducts,
};
