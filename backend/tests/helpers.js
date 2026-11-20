'use strict';

const { query } = require('../src/config/database');

let sequence = 0;
const prefix = `T${Date.now().toString().slice(-7)}`;

function nextCode(label = 'PRD') {
  sequence += 1;
  return `${prefix}-${label}-${String(sequence).padStart(3, '0')}`;
}

async function adminUserId() {
  const { rows } = await query(`
    SELECT u.id FROM users u
      JOIN roles r ON r.id = u.role_id
     WHERE r.name = 'ADMINISTRADOR' AND u.active = TRUE
     ORDER BY u.id LIMIT 1
  `);
  return rows[0].id;
}

async function createProduct(overrides = {}) {
  const data = {
    code: nextCode('ALR'),
    name: `Producto de prueba ${sequence}`,
    purchasePrice: 100,
    salePrice: 150,
    minStock: 10,
    alertPercentage: 25,
    ...overrides,
  };
  const { rows } = await query(
    `INSERT INTO products (code, name, purchase_price, sale_price, quantity, min_stock, alert_percentage, active)
     VALUES ($1,$2,$3,$4,0,$5,$6,TRUE) RETURNING id`,
    [data.code, data.name, data.purchasePrice, data.salePrice, data.minStock, data.alertPercentage],
  );
  return { id: rows[0].id, code: data.code };
}

async function move(productId, type, quantity, daysAgo = 0, userId = null) {
  const actor = userId || await adminUserId();
  const when = new Date(Date.now() - daysAgo * 86400000).toISOString();
  await query(
    `SELECT fn_register_movement($1,$2,$3,$4,NULL,$5,'prueba automatizada',$6,NULL)`,
    [productId, type, quantity, actor, type === 'OUT' ? 'Salida de prueba de cobertura' : null, when],
  );
}

async function view(productId) {
  const { rows } = await query('SELECT * FROM v_product_inventory WHERE id = $1', [productId]);
  return rows[0];
}

async function cleanup(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  for (const id of list) {
    await query('DELETE FROM inventory_movements WHERE product_id = $1', [id]);
    await query('DELETE FROM product_alert_settings WHERE product_id = $1', [id]);
    await query('DELETE FROM product_suppliers WHERE product_id = $1', [id]);
    await query('DELETE FROM products WHERE id = $1', [id]);
  }
}

module.exports = { nextCode, adminUserId, createProduct, move, view, cleanup };
