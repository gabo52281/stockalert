-- STOCKALERT · Datos DEMOSTRATIVOS (REFERENCIA HISTÓRICA)
-- NO EJECUTAR: npm run seed está deshabilitado en la arquitectura multiempresa.
-- Este archivo se conserva solo como registro del formato anterior; no crea
-- usuarios, contraseñas ni datos en bases 005-008 y no debe copiarse a producción.
-- Todos los movimientos usaban fn_register_movement, por lo que el stock final
-- era consecuencia del historial y no un valor escrito directamente.

-- ---------------------------------------------------------------------------
-- Usuarios demo (contraseña hasheada en runtime por seed.js)
-- ---------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role_id, active) VALUES
  ('Admin Demo',        'admin@ejemplo.invalid',      '{{DEMO_HASH}}', (SELECT id FROM roles WHERE name = 'ADMINISTRADOR'),        TRUE),
  ('Encargado Demo',    'encargado@ejemplo.invalid',  '{{DEMO_HASH}}', (SELECT id FROM roles WHERE name = 'ENCARGADO_INVENTARIO'), TRUE),
  ('Consulta Demo',     'consulta@ejemplo.invalid',   '{{DEMO_HASH}}', (SELECT id FROM roles WHERE name = 'CONSULTA'),            TRUE),
  ('Usuario Inactivo',  'inactivo@ejemplo.invalid',   '{{DEMO_HASH}}', (SELECT id FROM roles WHERE name = 'CONSULTA'),            FALSE)
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------
INSERT INTO categories (name, description, active) VALUES
  ('Bebidas',            'Bebidas frías y aguas',                     TRUE),
  ('Snacks y Panadería', 'Panadería, snacks y productos de consumo',  TRUE),
  ('Limpieza',           'Productos de aseo y limpieza',              TRUE),
  ('Papelería',          'Útiles de oficina y papelería',             TRUE),
  ('Alimentos básicos',  'Granos, aceites y alimentos de despensa',   TRUE)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------------
INSERT INTO suppliers (name, tax_id, phone, email, address, contact_person, notes, active) VALUES
  ('Distribuidora Andina S.A.S.', '900111111-1', '3001112233', 'ventas@andina.example.co', 'Cra. 5 # 12-30, Lorica', 'María Gómez',  'Proveedor principal de bebidas', TRUE),
  ('Proveedora del Caribe',       '900222222-2', '3004445566', 'pedidos@caribe.example.co', 'Calle 9 # 3-18, Montería', 'Andrés Díaz', 'Panadería y snacks', TRUE),
  ('AgroFresh Lorica',            '900333333-3', '3012223344', 'contacto@agrofresh.example.co', 'Vereda El Cedral, Lorica', 'Lucía Pérez', 'Productos frescos y granos', TRUE),
  ('Papelería Central',           '900444444-4', '3023334455', 'info@papeleria.example.co', 'Calle 2 # 7-44, Lorica', 'Carlos Ruiz', 'Útiles de oficina', TRUE)
ON CONFLICT (tax_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Productos (quantity = 0: se calcula con los movimientos demostrativos)
-- ---------------------------------------------------------------------------
INSERT INTO products (code, name, description, category_id, supplier_id, purchase_price, sale_price, quantity, min_stock, alert_percentage, active) VALUES
  ('PROD-001', 'Agua mineral 500 ml',   'Botella de agua mineral 500 ml',            (SELECT id FROM categories WHERE name='Bebidas'),            (SELECT id FROM suppliers WHERE tax_id='900111111-1'), 800,  1500, 0, 30, 25, TRUE),
  ('PROD-002', 'Gaseosa cola 1.5 L',    'Gaseosa sabor cola botella 1.5 L',          (SELECT id FROM categories WHERE name='Bebidas'),            (SELECT id FROM suppliers WHERE tax_id='900111111-1'), 3200, 4800, 0, 30, 25, TRUE),
  ('PROD-003', 'Pan de yuca x10',       'Paquete de 10 unidades de pan de yuca',     (SELECT id FROM categories WHERE name='Snacks y Panadería'), (SELECT id FROM suppliers WHERE tax_id='900222222-2'), 4500, 6500, 0, 15, 25, TRUE),
  ('PROD-004', 'Leche entera 1 L',      'Leche entera caja 1 litro',                 (SELECT id FROM categories WHERE name='Alimentos básicos'), (SELECT id FROM suppliers WHERE tax_id='900333333-3'), 3900, 5200, 0, 10, 25, TRUE),
  ('PROD-005', 'Jabón líquido 1 L',     'Jabón de manos líquido 1 litro',            (SELECT id FROM categories WHERE name='Limpieza'),          (SELECT id FROM suppliers WHERE tax_id='900111111-1'), 5200, 7500, 0,  8, 25, TRUE),
  ('PROD-006', 'Cuaderno A4 50 hojas',  'Cuaderno tamaño A4 de 50 hojas',            (SELECT id FROM categories WHERE name='Papelería'),        (SELECT id FROM suppliers WHERE tax_id='900444444-4'), 2800, 4200, 0, 20, 25, TRUE),
  ('PROD-007', 'Aceite vegetal 1 L',    'Aceite vegetal botella 1 litro',            (SELECT id FROM categories WHERE name='Alimentos básicos'), (SELECT id FROM suppliers WHERE tax_id='900333333-3'), 7800, 10500,0, 20, 25, TRUE),
  ('PROD-008', 'Huevos docena',         'Docena de huevos frescos',                  (SELECT id FROM categories WHERE name='Alimentos básicos'), (SELECT id FROM suppliers WHERE tax_id='900333333-3'), 9500, 13000,0, 12, 25, TRUE),
  ('PROD-009', 'Arroz 1 kg',            'Arroz blanco paquete 1 kilogramo',          (SELECT id FROM categories WHERE name='Alimentos básicos'), (SELECT id FROM suppliers WHERE tax_id='900333333-3'), 4200, 5900, 0, 10, 25, TRUE),
  ('PROD-010', 'Café molido 250 g',     'Café molido paquete 250 gramos',            (SELECT id FROM categories WHERE name='Alimentos básicos'), (SELECT id FROM suppliers WHERE tax_id='900333333-3'), 8900, 12500,0,  6, 25, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO product_suppliers (product_id, supplier_id, is_primary)
SELECT p.id, s.id, TRUE
  FROM products p
  JOIN suppliers s ON s.tax_id = '900111111-1'
 WHERE p.code IN ('PROD-001','PROD-002','PROD-005')
ON CONFLICT (product_id, supplier_id) DO NOTHING;

-- Configuración demostrativa por producto (override del porcentaje global)
INSERT INTO product_alert_settings (product_id, preventive_percentage, analysis_window_days, min_history_days)
SELECT id, 40, 30, 7 FROM products WHERE code = 'PROD-002'
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO product_alert_settings (product_id, preventive_percentage, analysis_window_days, min_history_days)
SELECT id, 25, 15, 7 FROM products WHERE code = 'PROD-003'
ON CONFLICT (product_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Historial de movimientos demostrativo (30 días)
-- spec: código, stock inicial, salida diaria, día de reposición, cantidad
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user      BIGINT := (SELECT id FROM users WHERE email = 'encargado@ejemplo.invalid');
  v_supplier  BIGINT := (SELECT id FROM suppliers WHERE tax_id = '900111111-1');
  spec        RECORD;
  day_row     RECORD;
  v_product   BIGINT;
  v_key       VARCHAR(80);
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('PROD-001', 160::numeric, 2::numeric,  5, 20::numeric),
      ('PROD-002',  94::numeric, 2::numeric, NULL, NULL::numeric),
      ('PROD-003',  42::numeric, 1::numeric, NULL, NULL::numeric),
      ('PROD-004',  30::numeric, 1::numeric, NULL, NULL::numeric),
      ('PROD-005',  38::numeric, 1::numeric, NULL, NULL::numeric),
      ('PROD-006',  60::numeric, 1::numeric, 12, 30::numeric),
      ('PROD-007',  54::numeric, 1::numeric, NULL, NULL::numeric),
      ('PROD-008',  38::numeric, 1::numeric,  3, 10::numeric),
      ('PROD-009',  40::numeric, 1::numeric, NULL, NULL::numeric),
      ('PROD-010',  30::numeric, 1::numeric, NULL, NULL::numeric)
    ) AS t(code, initial_stock, daily_out, restock_day, restock_qty)
  LOOP
    v_product := (SELECT id FROM products WHERE code = spec.code);
    IF v_product IS NULL THEN CONTINUE; END IF;

    -- Entrada inicial trazable
    v_key := 'DEMO-' || spec.code || '-INIT';
    IF NOT EXISTS (SELECT 1 FROM inventory_movements WHERE source_key = v_key) THEN
      PERFORM fn_register_movement(
        v_product, 'IN', spec.initial_stock, v_user, v_supplier,
        NULL, 'Inventario inicial demostrativo',
        date_trunc('day', now()) - interval '35 days' + interval '9 hours',
        v_key
      );
    END IF;

    -- Salidas diarias y reposiciones intercaladas en orden cronológico
    FOR day_row IN SELECT gs FROM generate_series(29, 0, -1) AS gs LOOP
      IF spec.restock_day IS NOT NULL AND day_row.gs = spec.restock_day THEN
        v_key := 'DEMO-' || spec.code || '-IN-' || lpad(day_row.gs::text, 2, '0');
        IF NOT EXISTS (SELECT 1 FROM inventory_movements WHERE source_key = v_key) THEN
          PERFORM fn_register_movement(
            v_product, 'IN', spec.restock_qty, v_user, v_supplier,
            NULL, 'Reposición demostrativa',
            date_trunc('day', now()) - day_row.gs * interval '1 day' + interval '9 hours',
            v_key
          );
        END IF;
      END IF;

      v_key := 'DEMO-' || spec.code || '-OUT-' || lpad(day_row.gs::text, 2, '0');
      IF NOT EXISTS (SELECT 1 FROM inventory_movements WHERE source_key = v_key) THEN
        PERFORM fn_register_movement(
          v_product, 'OUT', spec.daily_out, v_user, NULL,
          'Venta diaria', 'Movimiento generado para datos demostrativos',
          date_trunc('day', now()) - day_row.gs * interval '1 day' + interval '10 hours',
          v_key
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Registro de auditoría de la carga demo
INSERT INTO audit_log (user_id, action, entity, details)
SELECT id, 'SEED_DEMO_DATA', 'database', '{"scope":"development","warning":"datos demostrativos"}'
  FROM users WHERE email = 'admin@ejemplo.invalid'
ON CONFLICT DO NOTHING;
