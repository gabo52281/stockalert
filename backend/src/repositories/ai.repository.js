'use strict';

const { query } = require('../config/database');

/**
 * Datos mínimos y reales que alimentan el modelo local de IA de inventario.
 * Toda la lógica predictiva vive en ai.service.js para poder probarla sin BD.
 */
async function loadInventorySignals(days) {
  const [products, movements] = await Promise.all([
    query(`
      SELECT p.id, p.code, p.name, p.category_name, p.supplier_name,
             p.quantity, p.min_stock, p.purchase_price, p.sale_price, p.alert_level
        FROM v_product_inventory p
       WHERE p.active = TRUE
       ORDER BY p.name
    `),
    query(`
      SELECT m.product_id,
             to_char(date_trunc('day', m.movement_date)::date, 'YYYY-MM-DD') AS day,
             SUM(m.quantity)::numeric AS units
        FROM inventory_movements m
       WHERE m.type = 'OUT'
         AND m.movement_date >= now() - ($1::int || ' days')::interval
       GROUP BY m.product_id, day
       ORDER BY day
    `, [days]),
  ]);

  return { products: products.rows, movements: movements.rows };
}

module.exports = { loadInventorySignals };
