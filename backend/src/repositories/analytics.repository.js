'use strict';

const { query } = require('../config/database');
const productsRepository = require('./products.repository');
const { FROM } = require('./movements.repository');

async function alertSummary() {
  const { rows } = await query(`
    SELECT
      count(*) FILTER (WHERE active)::int AS active_products,
      count(*) FILTER (WHERE active AND alert_level = 'NORMAL')::int AS normal,
      count(*) FILTER (WHERE active AND alert_level = 'BAJO')::int AS low,
      count(*) FILTER (WHERE active AND alert_level = 'CRITICO')::int AS critical,
      count(*) FILTER (WHERE active AND alert_level = 'AGOTADO')::int AS out_of_stock,
      count(*) FILTER (WHERE active AND alert_level IN ('BAJO','CRITICO','AGOTADO'))::int AS attention
    FROM v_product_inventory
  `);
  return rows[0];
}

async function findAlerts(filters) {
  return productsRepository.findAll({
    ...filters,
    status: 'active',
    sortBy: 'name',
    sortDir: 'asc',
  });
}

async function alertDetail(id) {
  const product = await productsRepository.findById(id);
  if (!product) return null;

  const { rows: recentMovements } = await query(
    `SELECT m.id, m.type, m.quantity, m.stock_before, m.stock_after,
            m.movement_date, u.name AS user_name, m.reason
       FROM inventory_movements m JOIN users u ON u.id = m.user_id
      WHERE m.product_id = $1 ORDER BY m.movement_date DESC LIMIT 10`,
    [id],
  );

  return { ...product, recentMovements };
}

async function indicatorsSummary(days) {
  const { rows } = await query(
    `WITH window_movements AS (
       SELECT m.* FROM inventory_movements m
        WHERE m.movement_date >= now() - ($1::int || ' days')::interval
     )
     SELECT
       (SELECT count(*)::int FROM v_product_inventory WHERE active) AS active_products,
       (SELECT COALESCE(SUM(quantity),0)::numeric FROM v_product_inventory WHERE active) AS total_units,
       (SELECT count(*)::int FROM v_product_inventory WHERE active AND alert_level='BAJO') AS low_products,
       (SELECT count(*)::int FROM v_product_inventory WHERE active AND alert_level='CRITICO') AS critical_products,
       (SELECT count(*)::int FROM v_product_inventory WHERE active AND alert_level='AGOTADO') AS out_of_stock_products,
       (SELECT COALESCE(SUM(quantity),0)::numeric FROM window_movements WHERE type='IN') AS entries,
       (SELECT COALESCE(SUM(quantity),0)::numeric FROM window_movements WHERE type='OUT') AS exits,
       (SELECT count(*)::int FROM window_movements) AS movement_count,
       (SELECT COALESCE(SUM(inventory_value),0)::numeric FROM v_product_inventory WHERE active) AS inventory_value,
       (SELECT COALESCE(SUM(inventory_sale_value),0)::numeric FROM v_product_inventory WHERE active) AS inventory_sale_value,
       $1::int AS window_days`,
    [days],
  );

  const result = rows[0];
  result.avg_daily_out = result.exits / days;
  result.coverage_days = result.avg_daily_out > 0
    ? Number((result.total_units / result.avg_daily_out).toFixed(2))
    : null;
  return result;
}

async function coverageList({ days, limit, offset }) {
  const { rows } = await query(
    `SELECT id, code, name, category_name, quantity, min_stock, alert_level,
            out_units_window, avg_daily_out, coverage_status, coverage_days
       FROM v_product_inventory
      WHERE active = TRUE AND effective_window_days = $1
      ORDER BY CASE WHEN coverage_days IS NULL THEN 1 ELSE 0 END, coverage_days ASC, name
      LIMIT $2 OFFSET $3`,
    [days, limit, offset],
  );
  const { rows: countRows } = await query(
    'SELECT count(*)::int AS total FROM v_product_inventory WHERE active = TRUE AND effective_window_days = $1',
    [days],
  );
  return { rows, total: countRows[0].total };
}

async function topProducts(days, limit = 8) {
  const { rows } = await query(
    `SELECT p.id, p.code, p.name, p.category_name, p.quantity, p.alert_level,
            COALESCE(SUM(m.quantity),0)::numeric AS total_out,
            COUNT(m.id)::int AS movements
       FROM v_product_inventory p
       LEFT JOIN inventory_movements m
         ON m.product_id = p.id AND m.type = 'OUT'
        AND m.movement_date >= now() - ($1::int || ' days')::interval
      WHERE p.active = TRUE
      GROUP BY p.id, p.code, p.name, p.category_name, p.quantity, p.alert_level
      ORDER BY total_out DESC, p.name
      LIMIT $2`,
    [days, limit],
  );
  return rows;
}

async function dashboard(days) {
  const [summary, alerts, series, distribution, recent, top, coverage, attention] = await Promise.all([
    indicatorsSummary(days),
    alertSummary(),
    require('./movements.repository').dailySeries(days),
    query(`
      SELECT alert_level AS level, count(*)::int AS total
        FROM v_product_inventory WHERE active = TRUE GROUP BY alert_level
    `),
    require('./movements.repository').recent(8),
    topProducts(days, 6),
    query(`
      SELECT code, name, coverage_days, alert_level
        FROM v_product_inventory
       WHERE active = TRUE AND coverage_days IS NOT NULL
       ORDER BY coverage_days ASC LIMIT 6
    `),
    query(`
      SELECT id, code, name, quantity, alert_level, coverage_days
        FROM v_product_inventory
       WHERE active = TRUE AND alert_level <> 'NORMAL'
       ORDER BY CASE alert_level
         WHEN 'AGOTADO' THEN 1 WHEN 'CRITICO' THEN 2 ELSE 3 END,
         coverage_days ASC NULLS LAST, name
       LIMIT 6
    `),
  ]);

  return {
    summary,
    alerts,
    series,
    distribution: distribution.rows,
    recentMovements: recent,
    topProducts: top,
    coverageRisk: coverage.rows,
    attentionProducts: attention.rows,
  };
}

// ---------------------------------------------------------------------------
// Reportes: cada reporte devuelve columnas + filas reales, respetando filtros.
// ---------------------------------------------------------------------------
const COLUMNS = {
  inventory: [
    { key: 'code', label: 'Código' }, { key: 'name', label: 'Producto' },
    { key: 'category_name', label: 'Categoría' }, { key: 'supplier_name', label: 'Proveedor' },
    { key: 'quantity', label: 'Existencia' }, { key: 'min_stock', label: 'Mínimo' },
    { key: 'alert_level', label: 'Estado' }, { key: 'purchase_price', label: 'Precio compra', format: 'currency' },
    { key: 'sale_price', label: 'Precio venta', format: 'currency' }, { key: 'inventory_value', label: 'Valorizado', format: 'currency' },
  ],
  'low-stock': [
    { key: 'code', label: 'Código' }, { key: 'name', label: 'Producto' },
    { key: 'quantity', label: 'Existencia' }, { key: 'min_stock', label: 'Mínimo' },
    { key: 'preventive_threshold', label: 'Umbral preventivo' },
    { key: 'coverage_days', label: 'Cobertura (días)' }, { key: 'alert_level', label: 'Estado' },
  ],
  critical: [
    { key: 'code', label: 'Código' }, { key: 'name', label: 'Producto' },
    { key: 'quantity', label: 'Existencia' }, { key: 'min_stock', label: 'Mínimo' },
    { key: 'alert_level', label: 'Estado' }, { key: 'supplier_name', label: 'Proveedor' },
  ],
  coverage: [
    { key: 'code', label: 'Código' }, { key: 'name', label: 'Producto' },
    { key: 'quantity', label: 'Existencia' }, { key: 'avg_daily_out', label: 'Salida diaria prom.' },
    { key: 'coverage_status', label: 'Estado cálculo' },
    { key: 'coverage_days', label: 'Cobertura (días)' }, { key: 'alert_level', label: 'Alerta' },
  ],
  valuation: [
    { key: 'code', label: 'Código' }, { key: 'name', label: 'Producto' },
    { key: 'quantity', label: 'Existencia' }, { key: 'purchase_price', label: 'Precio compra', format: 'currency' },
    { key: 'inventory_value', label: 'Valor compra', format: 'currency' }, { key: 'sale_price', label: 'Precio venta', format: 'currency' },
    { key: 'inventory_sale_value', label: 'Valor venta', format: 'currency' },
  ],
  'top-products': [
    { key: 'code', label: 'Código' }, { key: 'name', label: 'Producto' },
    { key: 'total_out', label: 'Unidades salidas' }, { key: 'movements', label: 'Movimientos' },
    { key: 'quantity', label: 'Existencia actual' }, { key: 'alert_level', label: 'Estado' },
  ],
};

const MOVEMENT_COLUMNS_REPORT = [
  { key: 'movement_date', label: 'Fecha' }, { key: 'type', label: 'Tipo' },
  { key: 'product_code', label: 'Código' }, { key: 'product_name', label: 'Producto' },
  { key: 'quantity', label: 'Cantidad' }, { key: 'stock_before', label: 'Stock anterior' },
  { key: 'stock_after', label: 'Stock resultante' }, { key: 'user_name', label: 'Usuario' },
  { key: 'supplier_name', label: 'Proveedor' }, { key: 'reason', label: 'Motivo' },
  { key: 'notes', label: 'Observaciones' },
];

// Los alias de salida no son visibles en el mismo SELECT: se califican las columnas.
const MOVEMENT_SELECT = {
  movement_date: 'm.movement_date',
  type: 'm.type',
  product_code: 'p.code AS product_code',
  product_name: 'p.name AS product_name',
  quantity: 'm.quantity',
  stock_before: 'm.stock_before',
  stock_after: 'm.stock_after',
  user_name: 'u.name AS user_name',
  supplier_name: 's.name AS supplier_name',
  reason: 'm.reason',
  notes: 'm.notes',
};

function movementFilters(filters, forceType) {
  const where = [];
  const values = [];

  if (forceType) {
    values.push(forceType);
    where.push(`m.type = $${values.length}`);
  } else if (filters.type) {
    values.push(filters.type);
    where.push(`m.type = $${values.length}`);
  }
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
  if (filters.from) {
    values.push(filters.from);
    where.push(`m.movement_date >= $${values.length}`);
  }
  if (filters.to) {
    values.push(filters.to);
    where.push(`m.movement_date <= $${values.length}`);
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

/** Resuelve nombres legibles para los filtros sin exponer SQL dinámico. */
async function resolveFilterLabels(filters = {}) {
  const lookups = [
    ['productId', 'products'],
    ['categoryId', 'categories'],
    ['supplierId', 'suppliers'],
    ['userId', 'users'],
  ];
  const labels = {};

  await Promise.all(lookups.map(async ([key, table]) => {
    if (!filters[key]) return;
    const { rows } = await query(`SELECT name FROM ${table} WHERE id = $1 LIMIT 1`, [filters[key]]);
    if (rows[0]?.name) labels[key] = rows[0].name;
  }));

  return labels;
}

async function reportData(name, filters) {
  const TITLES = {
    inventory: 'Inventario actual',
    'low-stock': 'Productos con stock bajo',
    critical: 'Productos críticos y agotados',
    'movements-in': 'Historial de entradas',
    'movements-out': 'Historial de salidas',
    'movements-range': 'Movimientos por rango de fechas',
    'movements-by-user': 'Movimientos por usuario',
    'top-products': 'Productos con mayores salidas',
    coverage: 'Cobertura de inventario',
    valuation: 'Valoración estimada del inventario',
  };

  let columns;
  let rows;
  let params = [];

  if (name === 'inventory' || name === 'low-stock' || name === 'critical' || name === 'coverage' || name === 'valuation') {
    columns = COLUMNS[name];
    const where = ['active = TRUE'];
    if (name === 'low-stock') where.push("alert_level = 'BAJO'");
    if (name === 'critical') where.push("alert_level IN ('CRITICO','AGOTADO')");
    if (filters.categoryId) {
      params.push(filters.categoryId);
      where.push(`category_id = $${params.length}`);
    }
    if (filters.productId) {
      params.push(filters.productId);
      where.push(`id = $${params.length}`);
    }
    if (filters.status && ['NORMAL', 'BAJO', 'CRITICO', 'AGOTADO'].includes(filters.status)) {
      params.push(filters.status);
      where.push(`alert_level = $${params.length}`);
    }
    if (name === 'inventory' && (filters.status === 'active' || filters.status === 'inactive')) {
      where[0] = `active = ${filters.status === 'active' ? 'TRUE' : 'FALSE'}`;
    }
    const { rows: result } = await query(
      `SELECT ${columns.map((c) => c.key).join(', ')} FROM v_product_inventory
        WHERE ${where.join(' AND ')} ORDER BY name`,
      params,
    );
    rows = result;
  } else if (name === 'top-products') {
    columns = COLUMNS['top-products'];
    params = [filters.days || 30, filters.limit || 50];
    const { rows: result } = await query(
      `SELECT p.code, p.name, COALESCE(SUM(m.quantity),0)::numeric AS total_out,
              COUNT(m.id)::int AS movements, p.quantity, p.alert_level
         FROM v_product_inventory p
         LEFT JOIN inventory_movements m ON m.product_id = p.id AND m.type='OUT'
          AND m.movement_date >= now() - ($1::int || ' days')::interval
        WHERE p.active = TRUE
        GROUP BY p.code, p.name, p.quantity, p.alert_level
        ORDER BY total_out DESC LIMIT $2`,
      params,
    );
    rows = result;
  } else {
    columns = MOVEMENT_COLUMNS_REPORT;
    const forced = name === 'movements-in' ? 'IN' : name === 'movements-out' ? 'OUT' : null;
    const { clause, values } = movementFilters(filters, forced);
    const { rows: result } = await query(
      `SELECT ${MOVEMENT_COLUMNS_REPORT.map((c) => MOVEMENT_SELECT[c.key]).join(', ')} ${FROM} ${clause}
        ORDER BY m.movement_date DESC, m.id DESC LIMIT 5000`,
      values,
    );
    rows = result;
  }

  return {
    title: TITLES[name],
    columns,
    rows,
    filters,
    filterLabels: await resolveFilterLabels(filters),
    generatedAt: new Date(),
  };
}

module.exports = {
  alertSummary, findAlerts, alertDetail, indicatorsSummary,
  coverageList, topProducts, dashboard, reportData, resolveFilterLabels, COLUMNS,
};
