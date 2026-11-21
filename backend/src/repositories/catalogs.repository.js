'use strict';

const { query } = require('../config/database');
const { tenantPredicate } = require('../config/tenant');

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------
async function findCategories({ q, search, status, limit, offset }) {
  const where = [];
  const values = [];
  const term = q || search;

  if (term) {
    values.push(`%${term}%`);
    where.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`);
  }
  if (status === 'active') where.push('active = TRUE');
  if (status === 'inactive') where.push('active = FALSE');

  const [rows, count] = await Promise.all([
    query(
      `SELECT c.*, (SELECT count(*)::int FROM products p
                     WHERE p.category_id = c.id AND p.establishment_id = c.establishment_id)
                    AS products_count
         FROM categories c WHERE ${[tenantPredicate('c'), ...where].join(' AND ')}
        ORDER BY c.name LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    query(
      `SELECT count(*)::int AS total FROM categories c
        WHERE ${[tenantPredicate('c'), ...where].join(' AND ')}`,
      values,
    ),
  ]);
  return { rows: rows.rows, total: count.rows[0].total };
}

async function findCategoryById(id) {
  const { rows } = await query(
    `SELECT * FROM categories WHERE id = $1 AND ${tenantPredicate('categories')}`,
    [id],
  );
  return rows[0] || null;
}

async function createCategory({ name, description, active }) {
  const { rows } = await query(
    `INSERT INTO categories (establishment_id, name, description, active)
     VALUES (fn_app_establishment_id(), $1, $2, $3) RETURNING *`,
    [name, description || null, active],
  );
  return rows[0];
}

async function updateCategory(id, fields) {
  const sets = [];
  const values = [id];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    values.push(value);
    sets.push(`${key} = $${values.length}`);
  }
  if (!sets.length) return findCategoryById(id);
  const { rows } = await query(
    `UPDATE categories SET ${sets.join(', ')}
      WHERE id = $1 AND ${tenantPredicate('categories')} RETURNING *`,
    values,
  );
  return rows[0];
}

async function categoryHasProducts(id) {
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM products
      WHERE category_id = $1 AND ${tenantPredicate('products')}`,
    [id],
  );
  return rows[0].n > 0;
}

async function deleteCategory(id) {
  await query(
    `DELETE FROM categories WHERE id = $1 AND ${tenantPredicate('categories')}`,
    [id],
  );
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------
async function findSuppliers({ q, search, status, limit, offset }) {
  const where = [];
  const values = [];
  const term = q || search;

  if (term) {
    values.push(`%${term}%`);
    where.push(`(name ILIKE $${values.length} OR tax_id ILIKE $${values.length}
                 OR email ILIKE $${values.length} OR contact_person ILIKE $${values.length})`);
  }
  if (status === 'active') where.push('active = TRUE');
  if (status === 'inactive') where.push('active = FALSE');

  const [rows, count] = await Promise.all([
    query(
      `SELECT s.*, (SELECT count(*)::int FROM products p
                     WHERE p.supplier_id = s.id AND p.establishment_id = s.establishment_id)
                    AS products_count
         FROM suppliers s WHERE ${[tenantPredicate('s'), ...where].join(' AND ')}
        ORDER BY s.name LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    query(
      `SELECT count(*)::int AS total FROM suppliers s
        WHERE ${[tenantPredicate('s'), ...where].join(' AND ')}`,
      values,
    ),
  ]);
  return { rows: rows.rows, total: count.rows[0].total };
}

async function findSupplierById(id) {
  const { rows } = await query(
    `SELECT * FROM suppliers WHERE id = $1 AND ${tenantPredicate('suppliers')}`,
    [id],
  );
  return rows[0] || null;
}

async function createSupplier(data) {
  const { rows } = await query(
    `INSERT INTO suppliers (establishment_id, name, tax_id, phone, email,
       address, contact_person, notes, active)
     VALUES (fn_app_establishment_id(),$1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [data.name, data.taxId || null, data.phone || null, data.email || null,
      data.address || null, data.contactPerson || null, data.notes || null, data.active],
  );
  return rows[0];
}

async function updateSupplier(id, fields) {
  const map = {
    name: 'name', taxId: 'tax_id', phone: 'phone', email: 'email',
    address: 'address', contactPerson: 'contact_person', notes: 'notes', active: 'active',
  };
  const sets = [];
  const values = [id];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    values.push(value);
    sets.push(`${map[key]} = $${values.length}`);
  }
  if (!sets.length) return findSupplierById(id);
  const { rows } = await query(
    `UPDATE suppliers SET ${sets.join(', ')}
      WHERE id = $1 AND ${tenantPredicate('suppliers')} RETURNING *`,
    values,
  );
  return rows[0];
}

async function supplierHasProducts(id) {
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM products p
      WHERE ${tenantPredicate('p')} AND (
        p.supplier_id = $1 OR EXISTS (
          SELECT 1 FROM product_suppliers ps WHERE ps.supplier_id = $1
           AND ps.product_id = p.id AND ${tenantPredicate('ps')}
        )
      )`,
    [id],
  );
  return rows[0].n > 0;
}

async function deleteSupplier(id) {
  await query(
    `DELETE FROM suppliers WHERE id = $1 AND ${tenantPredicate('suppliers')}`,
    [id],
  );
}

async function supplierProducts(id) {
  const { rows } = await query(
    `SELECT p.id, p.code, p.name, p.quantity, p.alert_level, p.purchase_price
       FROM v_product_inventory p
      WHERE ${tenantPredicate('p')} AND (
        p.supplier_id = $1 OR EXISTS (
          SELECT 1 FROM product_suppliers ps WHERE ps.supplier_id = $1
           AND ps.product_id = p.id AND ${tenantPredicate('ps')}
        )
      )
      ORDER BY p.name`,
    [id],
  );
  return rows;
}

module.exports = {
  findCategories, findCategoryById, createCategory, updateCategory,
  categoryHasProducts, deleteCategory,
  findSuppliers, findSupplierById, createSupplier, updateSupplier,
  supplierHasProducts, deleteSupplier, supplierProducts,
};
