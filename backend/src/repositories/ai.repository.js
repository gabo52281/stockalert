'use strict';

const { query } = require('../config/database');
const { tenantPredicate } = require('../config/tenant');

/**
 * Señales mínimas y reales del establecimiento autenticado. Ninguna consulta
 * del copiloto puede leer datos de otra empresa, incluso si el rol de conexión
 * a PostgreSQL omite RLS.
 */
async function loadInventorySignals(days) {
  const [products, movements] = await Promise.all([
    query(`
      SELECT p.id, p.code, p.name, p.category_name, p.supplier_name,
             p.quantity, p.min_stock, p.purchase_price, p.sale_price, p.alert_level
        FROM v_product_inventory p
       WHERE ${tenantPredicate('p')} AND p.active = TRUE
       ORDER BY p.name
    `),
    query(`
      SELECT m.product_id,
             to_char(date_trunc('day', m.movement_date)::date, 'YYYY-MM-DD') AS day,
             SUM(m.quantity)::numeric AS units
        FROM inventory_movements m
       WHERE ${tenantPredicate('m')}
         AND m.type = 'OUT'
         AND m.movement_date >= now() - ($1::int || ' days')::interval
       GROUP BY m.product_id, day
       ORDER BY day
    `, [days]),
  ]);

  return { products: products.rows, movements: movements.rows };
}

/** Totales agregados y sin datos personales para el contexto del copiloto. */
async function loadMovementTotals(days) {
  const { rows } = await query(
    `SELECT m.type,
            COUNT(m.id)::int AS movements,
            COALESCE(SUM(m.quantity), 0)::numeric AS units
       FROM inventory_movements m
      WHERE ${tenantPredicate('m')}
        AND m.movement_date >= now() - ($1::int || ' days')::interval
      GROUP BY m.type`,
    [days],
  );
  return rows;
}

module.exports = { loadInventorySignals, loadMovementTotals };
