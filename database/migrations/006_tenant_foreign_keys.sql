-- STOCKALERT · Migración 006 · Integridad referencial por establecimiento
-- Complementa 005: impide asociar entidades de un tenant con catálogos de otro.

ALTER TABLE users      ADD CONSTRAINT users_tenant_id_key UNIQUE (establishment_id, id);
ALTER TABLE categories ADD CONSTRAINT categories_tenant_id_key UNIQUE (establishment_id, id);
ALTER TABLE suppliers  ADD CONSTRAINT suppliers_tenant_id_key UNIQUE (establishment_id, id);
ALTER TABLE products   ADD CONSTRAINT products_tenant_id_key UNIQUE (establishment_id, id);

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_tenant_category_fk,
  ADD CONSTRAINT products_tenant_category_fk
    FOREIGN KEY (establishment_id, category_id)
    REFERENCES categories (establishment_id, id) ON DELETE RESTRICT;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_tenant_supplier_fk,
  ADD CONSTRAINT products_tenant_supplier_fk
    FOREIGN KEY (establishment_id, supplier_id)
    REFERENCES suppliers (establishment_id, id) ON DELETE RESTRICT;

ALTER TABLE product_suppliers
  DROP CONSTRAINT IF EXISTS product_suppliers_tenant_product_fk,
  ADD CONSTRAINT product_suppliers_tenant_product_fk
    FOREIGN KEY (establishment_id, product_id)
    REFERENCES products (establishment_id, id) ON DELETE CASCADE;

ALTER TABLE product_suppliers
  DROP CONSTRAINT IF EXISTS product_suppliers_tenant_supplier_fk,
  ADD CONSTRAINT product_suppliers_tenant_supplier_fk
    FOREIGN KEY (establishment_id, supplier_id)
    REFERENCES suppliers (establishment_id, id) ON DELETE RESTRICT;

ALTER TABLE inventory_movements
  DROP CONSTRAINT IF EXISTS movements_tenant_product_fk,
  ADD CONSTRAINT movements_tenant_product_fk
    FOREIGN KEY (establishment_id, product_id)
    REFERENCES products (establishment_id, id) ON DELETE RESTRICT;

ALTER TABLE inventory_movements
  DROP CONSTRAINT IF EXISTS movements_tenant_supplier_fk,
  ADD CONSTRAINT movements_tenant_supplier_fk
    FOREIGN KEY (establishment_id, supplier_id)
    REFERENCES suppliers (establishment_id, id) ON DELETE RESTRICT;

ALTER TABLE product_alert_settings
  DROP CONSTRAINT IF EXISTS alert_settings_tenant_product_fk,
  ADD CONSTRAINT alert_settings_tenant_product_fk
    FOREIGN KEY (establishment_id, product_id)
    REFERENCES products (establishment_id, id) ON DELETE CASCADE;
