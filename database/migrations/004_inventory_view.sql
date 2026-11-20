-- STOCKALERT · Migración 004 · Vista unificada de inventario, alertas y cobertura
-- Toda la lógica determinista del motor preventivo vive aquí para garantizar
-- que productos, alertas, dashboard, indicadores y reportes coincidan.

CREATE OR REPLACE VIEW v_product_inventory AS
WITH globals AS (
  SELECT
    COALESCE((SELECT value #>> '{}' FROM system_settings WHERE key = 'alert.preventive_percentage')::numeric, 25) AS preventive_percentage,
    COALESCE((SELECT value #>> '{}' FROM system_settings WHERE key = 'metrics.analysis_window_days')::integer, 30) AS window_days,
    COALESCE((SELECT value #>> '{}' FROM system_settings WHERE key = 'metrics.min_history_days')::integer, 7) AS min_history_days
),
base AS (
  SELECT
    p.id, p.code, p.name, p.description, p.category_id, p.supplier_id,
    p.purchase_price, p.sale_price, p.quantity, p.min_stock, p.alert_percentage,
    p.active, p.last_movement_at, p.created_at, p.updated_at,
    c.name AS category_name,
    s.name AS supplier_name,
    COALESCE(pas.preventive_percentage, g.preventive_percentage) AS effective_percentage,
    COALESCE(pas.analysis_window_days, g.window_days) AS effective_window_days,
    COALESCE(pas.min_history_days, g.min_history_days) AS effective_min_history_days
  FROM products p
  CROSS JOIN globals g
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  LEFT JOIN product_alert_settings pas ON pas.product_id = p.id
),
movstats AS (
  SELECT
    b.id,
    COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'OUT'), 0) AS out_units_window,
    COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'IN'), 0) AS in_units_window,
    COUNT(m.id) FILTER (WHERE m.type = 'OUT')::integer AS out_movements_window,
    MIN(m.movement_date) FILTER (WHERE m.type = 'OUT') AS first_out_window
  FROM base b
  LEFT JOIN inventory_movements m
    ON m.product_id = b.id
   AND m.movement_date >= now() - (b.effective_window_days || ' days')::interval
  GROUP BY b.id
),
calculated AS (
  SELECT
    b.*,
    b.min_stock * (1 + b.effective_percentage / 100.0) AS preventive_threshold,
    CASE
      WHEN b.quantity = 0 THEN 'AGOTADO'
      WHEN b.quantity <= b.min_stock THEN 'CRITICO'
      WHEN b.quantity <= b.min_stock * (1 + b.effective_percentage / 100.0) THEN 'BAJO'
      ELSE 'NORMAL'
    END AS alert_level,
    m.out_units_window,
    m.in_units_window,
    m.out_movements_window,
    m.first_out_window,
    m.out_units_window / b.effective_window_days::numeric AS avg_daily_out,
    CASE
      WHEN m.out_units_window <= 0 THEN 'NO_CALCULABLE'
      WHEN m.first_out_window > now() - (b.effective_min_history_days || ' days')::interval THEN 'INSUFICIENTE'
      ELSE 'CALCULABLE'
    END AS coverage_status
  FROM base b
  JOIN movstats m ON m.id = b.id
)
SELECT
  c.*,
  CASE
    WHEN c.coverage_status = 'CALCULABLE'
      THEN ROUND(c.quantity / NULLIF(c.avg_daily_out, 0), 2)
    ELSE NULL
  END AS coverage_days,
  ROUND(c.quantity * c.purchase_price, 2) AS inventory_value,
  ROUND(c.quantity * c.sale_price, 2) AS inventory_sale_value
FROM calculated c;
