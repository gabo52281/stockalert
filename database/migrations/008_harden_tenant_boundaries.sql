-- STOCKALERT · Migración 008 · Defensa en profundidad multiempresa
-- Endurece 005/006/007: el superadministrador no puede leer inventario de
-- ningún establecimiento, el registro atómico valida todas las relaciones y
-- los movimientos quedan ligados al usuario de su mismo establecimiento.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories','suppliers','products','product_suppliers',
    'inventory_movements','product_alert_settings'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
      USING (fn_app_is_system() OR establishment_id = fn_app_establishment_id())
      WITH CHECK (fn_app_is_system() OR establishment_id = fn_app_establishment_id())
    $p$, t);
  END LOOP;
END $$;

-- La tabla de establecimientos también queda protegida: el superadministrador
-- ve todos, un usuario normal solo el suyo y SYSTEM puede administrar.
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishments FORCE ROW LEVEL SECURITY;

-- El registro de movimientos debe ser seguro incluso si se llama fuera de la API.
CREATE OR REPLACE FUNCTION fn_register_movement(
  p_product_id    BIGINT,
  p_type          VARCHAR(3),
  p_quantity      NUMERIC,
  p_user_id       BIGINT,
  p_supplier_id   BIGINT DEFAULT NULL,
  p_reason        VARCHAR(180) DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL,
  p_movement_date TIMESTAMPTZ DEFAULT now(),
  p_source_key    VARCHAR(80) DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_stock_before NUMERIC(14,3);
  v_stock_after  NUMERIC(14,3);
  v_delta        NUMERIC(14,3);
  v_active       BOOLEAN;
  v_establishment_id BIGINT;
  v_movement_id  BIGINT;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
  END IF;
  IF p_type NOT IN ('IN', 'OUT') THEN
    RAISE EXCEPTION 'INVALID_MOVEMENT_TYPE' USING ERRCODE = '22023';
  END IF;
  IF p_type = 'OUT' AND (p_reason IS NULL OR btrim(p_reason) = '') THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT quantity, active, establishment_id
    INTO v_stock_before, v_active, v_establishment_id
    FROM products
   WHERE id = p_product_id
     AND (fn_app_is_system() OR establishment_id = fn_app_establishment_id())
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_active THEN
    RAISE EXCEPTION 'PRODUCT_INACTIVE' USING ERRCODE = '23514';
  END IF;

  IF p_user_id IS NOT NULL AND NOT fn_app_is_system()
     AND NOT EXISTS (
       SELECT 1 FROM users
        WHERE id = p_user_id AND establishment_id = v_establishment_id
     ) THEN
    RAISE EXCEPTION 'USER_TENANT_MISMATCH' USING ERRCODE = '23503';
  END IF;

  IF p_supplier_id IS NOT NULL AND NOT fn_app_is_system()
     AND NOT EXISTS (
       SELECT 1 FROM suppliers
        WHERE id = p_supplier_id AND establishment_id = v_establishment_id
     ) THEN
    RAISE EXCEPTION 'SUPPLIER_TENANT_MISMATCH' USING ERRCODE = '23503';
  END IF;

  v_delta       := CASE WHEN p_type = 'IN' THEN p_quantity ELSE -p_quantity END;
  v_stock_after := v_stock_before + v_delta;
  IF v_stock_after < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = '23514';
  END IF;

  UPDATE products
     SET quantity = v_stock_after, last_movement_at = now()
   WHERE id = p_product_id;

  INSERT INTO inventory_movements (
    establishment_id, product_id, type, quantity, stock_before, stock_after,
    user_id, supplier_id, reason, notes, movement_date, source_key
  ) VALUES (
    v_establishment_id, p_product_id, p_type, p_quantity, v_stock_before, v_stock_after,
    p_user_id, p_supplier_id, p_reason, p_notes, p_movement_date, p_source_key
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- Solo se crea la FK cuando los datos existentes son consistentes. En una
-- instalación con usuarios heredados sin establecimiento, debe asignarlos
-- explícitamente antes de volver a ejecutar esta migración.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM inventory_movements m
      JOIN users u ON u.id = m.user_id
     WHERE m.establishment_id IS DISTINCT FROM u.establishment_id
  ) THEN
    ALTER TABLE inventory_movements
      DROP CONSTRAINT IF EXISTS movements_tenant_user_fk,
      ADD CONSTRAINT movements_tenant_user_fk
        FOREIGN KEY (establishment_id, user_id)
        REFERENCES users (establishment_id, id) ON DELETE RESTRICT;
  ELSE
    RAISE NOTICE 'movements_tenant_user_fk omitida: usuarios heredados sin establecimiento asignado';
  END IF;
END $$;
