'use strict';

const repository = require('../repositories/products.repository');
const catalogs = require('../repositories/catalogs.repository');
const ApiError = require('../utils/ApiError');

async function validateReferences({ categoryId, supplierId }) {
  if (categoryId) {
    const category = await catalogs.findCategoryById(categoryId);
    if (!category) throw ApiError.badRequest('La categoría indicada no existe', 'INVALID_CATEGORY');
  }
  if (supplierId) {
    const supplier = await catalogs.findSupplierById(supplierId);
    if (!supplier) throw ApiError.badRequest('El proveedor indicado no existe', 'INVALID_SUPPLIER');
  }
}

async function list(filters) {
  return repository.findAll(filters);
}

async function get(id) {
  const product = await repository.findById(id);
  if (!product) throw ApiError.notFound('Producto no encontrado');
  return product;
}

async function create(data) {
  await validateReferences(data);
  const exists = await repository.findByCode(data.code);
  if (exists) throw ApiError.conflict('Ya existe un producto con ese código', 'DUPLICATE_CODE');
  return repository.create(data);
}

async function update(id, fields) {
  await get(id);
  await validateReferences(fields);
  if (fields.code) {
    const other = await repository.findByCode(fields.code);
    if (other && Number(other.id) !== Number(id)) {
      throw ApiError.conflict('Ya existe un producto con ese código', 'DUPLICATE_CODE');
    }
  }
  return repository.update(id, fields);
}

async function setActive(id, active) {
  await get(id);
  return repository.setActive(id, active);
}

async function setAlertSettings(id, settings) {
  await get(id);
  return repository.setAlertSettings(id, settings);
}

async function remove(id) {
  await get(id);
  return repository.remove(id);
}

module.exports = { list, get, create, update, setActive, setAlertSettings, remove };
