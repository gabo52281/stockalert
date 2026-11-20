'use strict';

const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');

const COLUMNS = `
  id, code, name, description, category_id, supplier_id, category_name, supplier_name,
  purchase_price, sale_price, quantity, min_stock, alert_percentage,
  effective_percentage, effective_window_days, effective_min_history_days,
  preventive_threshold, alert_level,
  active, last_movement_at, created_at, updated_at,
  out_units_window, in_units_window, avg_daily_out,
  coverage_status, coverage_days, inventory_value, inventory_sale_value
`;

const SORT_MAP = {
  code: 'code', name: 'name', quantity: 'quantity', minStock: 'min_stock',
  createdAt: 'created_at', salePrice: 'sale_price',
};

const LEVEL_PRIORITY = `CASE alert_level
  WHEN 'AGOTADO' THEN 1 WHEN 'CRITICO' THEN 2 WHEN 'BAJO' THEN 3 ELSE 4 END`;

async function findAll(filters) {
  const where = [];
  const values = [];

  if (filters.q) {
    values.push(`%${filters.q}%`);
    where.push(`(name ILIKE $${values.length} OR code ILIKE $${values.length})`);
  }
  if (filters.categoryId) {
    values.push(filters.categoryId);
    where.push(`category_id = $${values.length}`);
  }
  if (filters.supplierId) {
    values.push(filters.supplierId);
    where.push(`(supplier_id = $${values.length} OR EXISTS (
      SELECT 1 FROM product_suppliers ps WHERE ps.product_id = v_product_inventory.id
       AND ps.supplier_id = $${values.length}))`);
  }
  if (filters.status === 'active') where.push('active = TRUE');
  if (filters.status === 'inactive') where.push('active = FALSE');
  if (filters.alertLevel) {
    values.push(filters.alertLevel);
    where.push(`alert_level = $${values.length}`);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = filters.alertLevel
    ? `${LEVEL_PRIORITY}, ${SORT_MAP[filters.sortBy]} ${filters.sortDir}`
    : `${SORT_MAP[filters.sortBy]} ${filters.sortDir}, id`;

  const [rows, count] = await Promise.all([
    query(
      `SELECT ${COLUMNS} FROM v_product_inventory ${clause}
        ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, filters.limit, filters.offset],
    ),
    query(`SELECT count(*)::int AS total FROM v_product_inventory ${clause}`, values),
  ]);
  return { rows: rows.rows, total: count.rows[0].total };
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM v_product_inventory WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function findByCode(code) {
  const { rows } = await query('SELECT id FROM products WHERE lower(code) = lower($1)', [code]);
  return rows[0] || null;
}

async function create(data) {
  const { rows } = await query(
    `INSERT INTO products (code, name, description, category_id, supplier_id,
       purchase_price, sale_price, quantity, min_stock, alert_percentage, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10)
     RETURNING id`,
    [data.code, data.name, data.description || null, data.categoryId || null,
      data.supplierId || null, data.purchasePrice, data.salePrice,
      data.minStock, data.alertPercentage, data.active],
  );
  return findById(rows[0].id);
}

async function update(id, fields) {
  const map = {
    code: 'code', name: 'name', description: 'description', categoryId: 'category_id',
    supplierId: 'supplier_id', purchasePrice: 'purchase_price', salePrice: 'sale_price',
    minStock: 'min_stock', alertPercentage: 'alert_percentage', active: 'active',
  };
  const sets = [];
  const values = [id];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    values.push(key === 'description' ? value : value);
    sets.push(`${map[key]} = $${values.length}`);
  }

  if (!sets.length) return findById(id);
  await query(`UPDATE products SET ${sets.join(', ')} WHERE id = $1`, values);
  return findById(id);
}

async function setActive(id, active) {
  await query('UPDATE products SET active = $1 WHERE id = $2', [active, id]);
  return findById(id);
}

async function setAlertSettings(id, settings) {
  await query(
    `INSERT INTO product_alert_settings (product_id, preventive_percentage, analysis_window_days, min_history_days)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (product_id) DO UPDATE SET
       preventive_percentage = EXCLUDED.preventive_percentage,
       analysis_window_days = EXCLUDED.analysis_window_days,
       min_history_days = EXCLUDED.min_history_days`,
    [id, settings.preventivePercentage, settings.analysisWindowDays, settings.minHistoryDays],
  );
  return findById(id);
}

async function hasMovements(id) {
  const { rows } = await query(
    'SELECT count(*)::int AS n FROM inventory_movements WHERE product_id = $1',
    [id],
  );
  return rows[0].n > 0;
}

async function remove(id) {
  if (await hasMovements(id)) {
    throw ApiError.conflict(
      'No se puede eliminar un producto con movimientos históricos. Desactívelo en su lugar.',
      'PRODUCT_HAS_MOVEMENTS',
    );
  }
  await query('DELETE FROM products WHERE id = $1', [id]);
}

module.exports = {
  findAll, findById, findByCode, create, update, setActive,
  setAlertSettings, hasMovements, remove, COLUMNS,
};
