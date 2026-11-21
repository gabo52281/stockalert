'use strict';

const { transaction } = require('../config/database');
const { tenantPredicate } = require('../config/tenant');
const movementsRepository = require('../repositories/movements.repository');
const productsRepository = require('../repositories/products.repository');
const { writeAudit } = require('../middlewares/audit');
const ApiError = require('../utils/ApiError');

async function validateInput(client, data, type) {
  const { rows } = await client.query(
    `SELECT id, active FROM products
      WHERE id = $1 AND establishment_id = fn_app_establishment_id()`,
    [data.productId],
  );
  if (!rows.length) throw ApiError.notFound('Producto no encontrado');
  if (!rows[0].active) throw ApiError.conflict('El producto está inactivo', 'PRODUCT_INACTIVE');

  if (type === 'IN' && data.supplierId) {
    const { rows: suppliers } = await client.query(
      `SELECT id FROM suppliers WHERE id = $1 AND ${tenantPredicate('suppliers')}`,
      [data.supplierId],
    );
    if (!suppliers.length) {
      throw ApiError.badRequest('El proveedor indicado no existe', 'INVALID_SUPPLIER');
    }
  }
}

async function registerMovement(data, user, req, type) {
  const result = await transaction(async (client) => {
    await validateInput(client, data, type);

    const movementId = await movementsRepository.register(client, {
      ...data,
      type,
      userId: user.id,
    });

    const movementResult = await client.query(
      `SELECT ${movementsRepository.MOVEMENT_COLUMNS} ${movementsRepository.FROM}
        ${movementsRepository.whereWithTenant(['m.id = $1'])}`,
      [movementId],
    );
    const productResult = await client.query(
      `SELECT ${productsRepository.COLUMNS} FROM v_product_inventory
        WHERE id = $1 AND ${tenantPredicate('v_product_inventory')}`,
      [data.productId],
    );

    return {
      movement: movementResult.rows[0],
      product: productResult.rows[0],
    };
  });

  await writeAudit(req, type === 'IN' ? 'MOVEMENT_IN' : 'MOVEMENT_OUT', 'movement',
    result.movement.id, {
      productId: data.productId, quantity: data.quantity, type,
    });

  return result;
}

function registerEntry(data, user, req) {
  return registerMovement(data, user, req, 'IN');
}

function registerExit(data, user, req) {
  return registerMovement(data, user, req, 'OUT');
}

async function list(filters) {
  return movementsRepository.findAll(filters);
}

async function get(id) {
  const movement = await movementsRepository.findById(id);
  if (!movement) throw ApiError.notFound('Movimiento no encontrado');
  return movement;
}

async function productHistory(productId) {
  await productsRepository.findById(productId);
  return movementsRepository.productMovements(productId, 100);
}

module.exports = { registerEntry, registerExit, list, get, productHistory };
