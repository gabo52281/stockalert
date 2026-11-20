# Base de datos

Motor: PostgreSQL administrado en **Neon** (PostgreSQL 14+). No hay PostgreSQL local, contenedores ni motores alternativos. Todas las cantidades son `NUMERIC(14,3)` para evitar errores de precisión.

## 1. Migraciones

| Archivo | Contenido |
| --- | --- |
| `001_init.sql` | Esquema completo, funciones, triggers e índices |
| `002_config.sql` | Roles y ajustes globales (25 %, 30 días, 7 días) |
| `003_fix_movement_type_length.sql` | Corrige `inventory_movements.type` de `VARCHAR(2)` a `VARCHAR(3)` |
| `004_inventory_view.sql` | Vista unificada `v_product_inventory` |

El runner `backend/src/scripts/migrate.js` mantiene `schema_migrations`, detecta las versiones ya aplicadas, aplica solo las pendientes en una transacción por archivo y permite `up`, `down` y `status`. Usa `pg_advisory_lock(742001)` para que dos despliegues concurrentes no apliquen la misma migración dos veces. En Neon usa la conexión directa (`DIRECT_URL` o derivada de la URL `-pooler`), porque las migraciones son DDL y no deben ejecutarse por el pooler en modo transacción. `001_init.sql` crea `pgcrypto` con `IF NOT EXISTS`; Neon lo soporta.

Las migraciones se ejecutan únicamente desde `npm run dev`, `npm run migrate` o el build de Vercel (`VERCEL=1`). Nunca se ejecutan por petición HTTP y no eliminan datos.

## 2. Tablas

| Tabla | Descripción | Restricciones destacadas |
| --- | --- | --- |
| `roles` | Catálogo de roles | `name UNIQUE` |
| `users` | Usuarios | `email UNIQUE`, formato de correo, FK a `roles` (`RESTRICT`) |
| `revoked_tokens` | JWT revocados por logout | `jti` PK, FK a `users` (`CASCADE`) |
| `categories` | Categorías | `name UNIQUE`, no vacío |
| `suppliers` | Proveedores | `tax_id UNIQUE`, correo válido |
| `products` | Catálogo y existencia | `code UNIQUE`, precios ≥ 0, `quantity ≥ 0`, `min_stock ≥ 0`, porcentaje 0–100, `sale_price ≥ purchase_price` o 0 |
| `product_suppliers` | Relación producto-proveedor | PK compuesta, un solo proveedor principal por producto |
| `inventory_movements` | Historial inmutable | `type IN/OUT`, `quantity > 0`, `stock_before/after ≥ 0`, consistencia aritmética, motivo obligatorio en salidas, `source_key UNIQUE` |
| `system_settings` | Ajustes globales JSONB | `key` PK |
| `product_alert_settings` | Ajustes por producto | `product_id` PK/FK, porcentaje 0–100, ventanas 1–365 días |
| `audit_log` | Bitácora de movimientos de inventario | IP, usuario, acción y detalles JSONB |
| `schema_migrations` | Control de versiones | `version` PK |

### Índices

- Búsquedas por producto, tipo y fecha en movimientos.
- Movimientos por usuario, por producto y por `movement_date`.
- Productos por código, nombre, categoría, proveedor y estado.
- Índice único parcial para el proveedor principal.
- `source_key UNIQUE` para idempotencia de cargas.

## 3. Integridad y concurrencia

- Las FK usan `RESTRICT` donde borrar un registro padre podría romper el historial; las relaciones de configuración usan `CASCADE`.
- `fn_register_movement()` usa `SELECT … FOR UPDATE` sobre `products` y calcula `stock_before`/`stock_after` en la propia base de datos.
- Los CHECK impiden cantidades negativas, stock negativo e incoherencia entre stock anterior/resultante.
- Los movimientos no se editan ni se eliminan desde la API.

Firma de la función:

```sql
fn_register_movement(
  p_product_id    BIGINT,
  p_type          VARCHAR(3),       -- IN | OUT
  p_quantity      NUMERIC,
  p_user_id       BIGINT,
  p_supplier_id   BIGINT DEFAULT NULL,
  p_reason        VARCHAR(180) DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL,
  p_movement_date TIMESTAMPTZ DEFAULT now(),
  p_source_key    VARCHAR(80) DEFAULT NULL
) RETURNS BIGINT
```

Errores relevantes: `INVALID_QUANTITY`, `INVALID_MOVEMENT_TYPE`, `REASON_REQUIRED`, `PRODUCT_NOT_FOUND`, `PRODUCT_INACTIVE`, `INSUFFICIENT_STOCK`.

## 4. Vista `v_product_inventory`

Columnas expuestas:

| Grupo | Columnas |
| --- | --- |
| Producto | `id`, `code`, `name`, `description`, `category_id`, `supplier_id`, `category_name`, `supplier_name`, `active`, `created_at`, `updated_at`, `last_movement_at` |
| Inventario | `purchase_price`, `sale_price`, `quantity`, `min_stock`, `alert_percentage` |
| Configuración efectiva | `effective_percentage`, `effective_window_days`, `effective_min_history_days`, `preventive_threshold` |
| Estado | `alert_level` (`NORMAL`, `BAJO`, `CRITICO`, `AGOTADO`) |
| Movimientos en ventana | `out_units_window`, `in_units_window`, `out_movements_window`, `first_out_window` |
| Indicadores | `avg_daily_out`, `coverage_status`, `coverage_days`, `inventory_value`, `inventory_sale_value` |

### Reglas implementadas

```text
preventive_threshold = min_stock * (1 + effective_percentage / 100)

alert_level =
  AGOTADO  si quantity = 0
  CRITICO  si 0 < quantity <= min_stock
  BAJO     si min_stock < quantity <= preventive_threshold
  NORMAL   en otro caso

avg_daily_out = out_units_window / effective_window_days
coverage_days = quantity / avg_daily_out   solo si coverage_status = 'CALCULABLE'

coverage_status =
  NO_CALCULABLE si out_units_window <= 0
  INSUFICIENTE  si first_out_window > now() - min_history_days
  CALCULABLE    en otro caso
```

Con `min_stock = 0` y stock positivo, el umbral es 0 y el estado es `NORMAL`.

Esta vista es consumida por productos, alertas, dashboard, indicadores y reportes: es la única fuente de verdad del motor preventivo.

## 5. Datos demostrativos

`database/seeds/001_demo.sql` + `backend/src/scripts/seed.js` cargan:

- 4 categorías, 4 proveedores, 10 productos.
- 4 usuarios (uno inactivo) con contraseña hash bcrypt generada en tiempo de ejecución.
- 313 movimientos distribuidos en los últimos 30 días, con `source_key` prefijado `DEMO-`.

El seed es idempotente y está pensado **solo para demostración**; `npm run seed` se bloquea automáticamente cuando `NODE_ENV=production` y nunca se ejecuta desde `npm run dev` ni desde el build. En producción se crea el administrador con `npm run admin` y los datos se cargan desde cero mediante movimientos reales.

## 6. Datos usados por el asistente IA

El módulo IA consulta `v_product_inventory` y agrupa `inventory_movements` de tipo `OUT` por producto y día. No crea tablas nuevas ni modifica el esquema: la lógica predictiva vive en `backend/src/services/ai.service.js` y puede probarse sin base de datos.
