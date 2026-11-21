'use strict';

const { query } = require('../config/database');
const { tenantPredicate } = require('../config/tenant');

const MOVEMENT_COLUMNS = `
  m.id, m.product_id, p.code AS product_code, p.name AS product_name,
  m.type, m.quantity, m.stock_before, m.stock_after,
  m.user_id, u.name AS user_name,
  m.supplier_id, s.name AS supplier_name,
  m.reason, m.notes, m.movement_date, m.created_at,
  c.name AS category_name
`;

const FROM = `
  FROM inventory_movements m
  JOIN products p ON p.id = m.product_id AND p.establishment_id = m.establishment_id
  LEFT JOIN users u ON u.id = m.user_id
    AND (u.establishment_id = m.establishment_id OR u.establishment_id IS NULL)
  LEFT JOIN suppliers s ON s.id = m.supplier_id AND s.establishment_id = m.establishment_id
  LEFT JOIN categories c ON c.id = p.category_id AND c.establishment_id = p.establishment_id
`;

/** Toda lectura de movimientos queda limitada al establecimiento validado. */
function whereWithTenant(extra = []) {
  return `WHERE ${[tenantPredicate('m'), ...extra].filter(Boolean).join(' AND ')}`;
}

/** Registro atómico usando la función PL/pgSQL con bloqueo de fila. */
async function register(client, data) {
  const { rows } = await client.query(
    `SELECT fn_register_movement($1,$2,$3,$4,$5,$6,$7,$8,$9) AS id`,
    [
      data.productId,
      data.type,
      data.quantity,
      data.userId,
      data.supplierId || null,
      data.reason || null,
      data.notes || null,
      data.movementDate || new Date(),
      data.sourceKey || null,
    ],
  );
  return rows[0].id;
}

async function findAll(filters) {
  const where = [];
  const values = [];

  if (filters.productId) {
    values.push(filters.productId);
    where.push(`m.product_id = $${values.length}`);
  }
  if (filters.categoryId) {
    values.push(filters.categoryId);
    where.push(`p.category_id = $${values.length}`);
  }
  if (filters.userId) {
    values.push(filters.userId);
    where.push(`m.user_id = $${values.length}`);
  }
  if (filters.supplierId) {
    values.push(filters.supplierId);
    where.push(`m.supplier_id = $${values.length}`);
  }
  if (filters.type) {
    values.push(filters.type);
    where.push(`m.type = $${values.length}`);
  }
  if (filters.from) {
    values.push(filters.from);
    where.push(`m.movement_date >= $${values.length}`);
  }
  if (filters.to) {
    values.push(filters.to);
    where.push(`m.movement_date <= $${values.length}`);
  }

  const clause = whereWithTenant(where);
  const [rows, count] = await Promise.all([
    query(
      `SELECT ${MOVEMENT_COLUMNS} ${FROM} ${clause}
        ORDER BY m.movement_date ${filters.sortDir}, m.id ${filters.sortDir}
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, filters.limit, filters.offset],
    ),
    query(`SELECT count(*)::int AS total ${FROM} ${clause}`, values),
  ]);
  return { rows: rows.rows, total: count.rows[0].total };
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${MOVEMENT_COLUMNS} ${FROM} ${whereWithTenant(['m.id = $1'])}`,
    [id],
  );
  return rows[0] || null;
}

async function productMovements(productId, limit = 50) {
  const { rows } = await query(
    `SELECT ${MOVEMENT_COLUMNS} ${FROM} ${whereWithTenant(['m.product_id = $1'])}
      ORDER BY m.movement_date DESC, m.id DESC LIMIT $2`,
    [productId, limit],
  );
  return rows;
}

/** Serie diaria de entradas/salidas para el gráfico del dashboard. */
async function dailySeries(days, filters = {}) {
  const values = [days];
  let extra = '';
  if (filters.productId) {
    values.push(filters.productId);
    extra += ` AND m.product_id = $${values.length}`;
  }
  if (filters.categoryId) {
    values.push(filters.categoryId);
    extra += ` AND p.category_id = $${values.length}`;
  }

  const { rows } = await query(
    `WITH days AS (
       SELECT generate_series(
         date_trunc('day', now()) - ($1::int - 1) * interval '1 day',
         date_trunc('day', now()),
         interval '1 day'
       )::date AS day
     )
     SELECT d.day,
       COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'IN'), 0)::numeric AS inputs,
       COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'OUT'), 0)::numeric AS outputs
       FROM days d
       LEFT JOIN inventory_movements m
         ON m.movement_date >= d.day
        AND m.movement_date < d.day + interval '1 day'
        AND ${tenantPredicate('m')} ${extra}
       LEFT JOIN products p ON p.id = m.product_id AND p.establishment_id = m.establishment_id
      GROUP BY d.day ORDER BY d.day`,
    values,
  );
  return rows;
}

async function recent(limit = 8) {
  const { rows } = await query(
    `SELECT ${MOVEMENT_COLUMNS} ${FROM} ${whereWithTenant()}
      ORDER BY m.movement_date DESC, m.id DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

module.exports = {
  register, findAll, findById, productMovements, dailySeries, recent,
  MOVEMENT_COLUMNS, FROM, whereWithTenant,
};
