-- STOCKALERT · Migración 003 · Corrección de longitud del tipo de movimiento
-- 'OUT' tiene 3 caracteres; la definición inicial usaba VARCHAR(2).

ALTER TABLE inventory_movements
  ALTER COLUMN type TYPE VARCHAR(3);

DROP FUNCTION IF EXISTS fn_register_movement(
  BIGINT, VARCHAR, NUMERIC, BIGINT, BIGINT, VARCHAR, TEXT, TIMESTAMPTZ, VARCHAR
);

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

  SELECT quantity, active
    INTO v_stock_before, v_active
    FROM products
   WHERE id = p_product_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_active THEN
    RAISE EXCEPTION 'PRODUCT_INACTIVE' USING ERRCODE = '23514';
  END IF;

  v_delta       := CASE WHEN p_type = 'IN' THEN p_quantity ELSE -p_quantity END;
  v_stock_after := v_stock_before + v_delta;

  IF v_stock_after < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = '23514';
  END IF;

  UPDATE products
     SET quantity         = v_stock_after,
         last_movement_at = now()
   WHERE id = p_product_id;

  INSERT INTO inventory_movements (
    product_id, type, quantity, stock_before, stock_after,
    user_id, supplier_id, reason, notes, movement_date, source_key
  ) VALUES (
    p_product_id, p_type, p_quantity, v_stock_before, v_stock_after,
    p_user_id, p_supplier_id, p_reason, p_notes, p_movement_date, p_source_key
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;
