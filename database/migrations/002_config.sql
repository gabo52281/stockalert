-- STOCKALERT · Migración 002 · Configuración base del sistema

INSERT INTO roles (name, description) VALUES
  ('ADMINISTRADOR', 'Acceso total al sistema, incluida la gestión de usuarios y configuración.'),
  ('ENCARGADO_INVENTARIO', 'Gestiona productos, catálogos, movimientos y consulta indicadores.'),
  ('CONSULTA', 'Solo lectura de inventario, alertas, indicadores y reportes.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO system_settings (key, value, description) VALUES
  ('alert.preventive_percentage', '25'::jsonb,
   'Porcentaje preventivo global. Umbral BAJO = mínimo * (1 + porcentaje/100). Decisión de implementación.'),
  ('metrics.analysis_window_days', '30'::jsonb,
   'Ventana en días calendario para calcular promedio de salidas y cobertura.'),
  ('metrics.min_history_days', '7'::jsonb,
   'Días mínimos de historial de salidas para considerar "datos suficientes".'),
  ('system.name', '"STOCKALERT"'::jsonb,
   'Nombre comercial del sistema.')
ON CONFLICT (key) DO NOTHING;
