-- STOCKALERT · Migración 007 · Valor por defecto de tenant desde la sesión
-- Las sentencias INSERT existentes hereda el establecimiento validado del backend.
-- users y audit_log permiten NULL para la cuenta superadministrador global.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories','suppliers','products','product_suppliers',
    'inventory_movements','product_alert_settings','system_settings'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN establishment_id SET DEFAULT fn_app_establishment_id()', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN establishment_id SET NOT NULL', t);
  END LOOP;
END $$;

ALTER TABLE audit_log ALTER COLUMN establishment_id SET DEFAULT fn_app_establishment_id();
ALTER TABLE users ALTER COLUMN establishment_id SET DEFAULT fn_app_establishment_id();
