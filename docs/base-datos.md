# Base de datos

Motor: PostgreSQL administrado en **Neon** (PostgreSQL 14+). No hay PostgreSQL local, contenedores ni motores alternativos como dependencia del proyecto; el único PostgreSQL local usado ha sido un fixture desechable para pruebas. Todas las cantidades son `NUMERIC(14,3)` para evitar errores de precisión.

## 1. Migraciones

| Archivo | Contenido |
| --- | --- |
| `001_init.sql` | Esquema completo, funciones, triggers e índices |
| `002_config.sql` | Roles y ajustes globales (25 %, 30 días, 7 días) |
| `003_fix_movement_type_length.sql` | Corrige `inventory_movements.type` de `VARCHAR(2)` a `VARCHAR(3)` |
| `004_inventory_view.sql` | Vista unificada `v_product_inventory` |
| `005_multi_tenant.sql` | Base multiempresa: `establishments`, rol superadministrador, columnas `establishment_id`, unicidad por tenant, GUCs, RLS/FORCE RLS, vista filtrada, `fn_register_movement()` y índices |
| `006_tenant_foreign_keys.sql` | Foreign keys compuestas `(establishment_id, id)` para impedir relaciones entre tenants |
| `007_tenant_defaults.sql` | Defaults de `establishment_id` desde el GUC validado por transacción |
| `008_harden_tenant_boundaries.sql` | Activa RLS en `establishments`, endurece RLS (superadmin sin inventario), refuerza `fn_register_movement()` y añade la FK movimientos-usuario cuando los datos son consistentes |
| `009_remove_must_change_password.sql` | Elimina la columna `must_change_password`: el cambio de contraseña pasa a ser voluntario desde Perfil; el reset sigue invalidando sesiones con `password_version` |

El runner `backend/src/scripts/migrate.js` mantiene `schema_migrations`, detecta las versiones ya aplicadas, aplica solo las pendientes en una transacción por archivo y permite `up`, `down` y `status`. Usa `pg_advisory_lock(742001)` para que dos despliegues concurrentes no apliquen la misma migración dos veces. En Neon usa la conexión directa (`DIRECT_URL` o derivada de la URL `-pooler`), porque las migraciones son DDL y no deben ejecutarse por el pooler en modo transacción. `001_init.sql` crea `pgcrypto` con `IF NOT EXISTS`; Neon lo soporta.

Las migraciones se ejecutan únicamente desde `npm run dev` o `npm run migrate`. El build del servicio `backend` en Vercel usa `migrate.js build`: en producción omite migraciones salvo `ALLOW_PRODUCTION_MIGRATION=true`, para no bloquear el despliegue. Nunca se ejecutan por petición HTTP y no eliminan datos. **Las migraciones 005–008 ya se aplicaron a la Neon del propietario con autorización explícita**; la `009` queda pendiente hasta que se ejecute `npm run migrate` con esa misma autorización. El código ya no usa la columna, así que su presencia física no altera el comportamiento. Cualquier prueba de desarrollo debe hacerse contra un fixture local desechable.

## 2. Tablas

| Tabla | Descripción | Restricciones destacadas |
| --- | --- | --- |
| `establishments` | Establecimientos (tenants) | `id` identidad, `name` no vacío, `active` para bloquear el acceso |
| `roles` | Catálogo de roles | `name UNIQUE`; incluye `SUPERADMINISTRADOR` |
| `users` | Usuarios | `email UNIQUE` global, `establishment_id` nullable hasta asignación explícita, `password_version`, FK a `roles` (`RESTRICT`) |
| `revoked_tokens` | JWT revocados por logout | `jti` PK, FK a `users` (`CASCADE`) |
| `categories` | Categorías | `UNIQUE (establishment_id, name)`, no vacío |
| `suppliers` | Proveedores | `UNIQUE (establishment_id, tax_id)`, correo válido |
| `products` | Catálogo y existencia | `UNIQUE (establishment_id, code)`, precios ≥ 0, `quantity ≥ 0`, `min_stock ≥ 0`, porcentaje 0–100, `sale_price ≥ purchase_price` o 0 |
| `product_suppliers` | Relación producto-proveedor | PK compuesta, un solo proveedor principal por producto |
| `inventory_movements` | Historial inmutable | `type IN/OUT`, `quantity > 0`, `stock_before/after ≥ 0`, consistencia aritmética, motivo obligatorio en salidas, `UNIQUE (establishment_id, source_key)` |
| `system_settings` | Ajustes por establecimiento (JSONB) | PK `(establishment_id, key)` |
| `product_alert_settings` | Ajustes por producto | `product_id` PK/FK, porcentaje 0–100, ventanas 1–365 días |
| `audit_log` | Bitácora de movimientos de inventario | IP, usuario, acción y detalles JSONB |
| `schema_migrations` | Control de versiones | `version` PK |

Todas las tablas operativas incorporan `establishment_id` con FK a `establishments`. Los registros comerciales preexistentes (categorías, proveedores, productos, movimientos, ajustes y bitácora) se asignaron al establecimiento principal `id = 1`; los `users` quedaron en `NULL` a propósito, hasta una asignación o promoción explícita.

### Índices

- Búsquedas por producto, tipo y fecha en movimientos.
- Movimientos por usuario, por producto y por `movement_date`.
- Productos por código, nombre, categoría, proveedor y estado.
- Índice único parcial para el proveedor principal.
- `UNIQUE (establishment_id, source_key)` para idempotencia de cargas.
- Índices por `establishment_id` y compuestos `(establishment_id, active)` / `(establishment_id, product_id, movement_date DESC)` para el filtro de tenant.

## 3. Integridad y concurrencia

- Las FK usan `RESTRICT` donde borrar un registro padre podría romper el historial; las relaciones de configuración usan `CASCADE`.
- Las FK compuestas de la migración 006 exigen que producto, categoría, proveedor, usuario y ajustes pertenezcan al mismo establecimiento: `products (establishment_id, category_id)`, `products (establishment_id, supplier_id)`, `product_suppliers`, `inventory_movements` y `product_alert_settings`.
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

La migración 008 reforzó la función: el producto se bloquea solo dentro del tenant validado, el `establishment_id` del movimiento se deriva del producto, y `p_user_id` y `p_supplier_id` deben pertenecer a ese mismo establecimiento (salvo en el contexto interno `SYSTEM`). Errores relevantes: `INVALID_QUANTITY`, `INVALID_MOVEMENT_TYPE`, `REASON_REQUIRED`, `PRODUCT_NOT_FOUND`, `PRODUCT_INACTIVE`, `USER_TENANT_MISMATCH`, `SUPPLIER_TENANT_MISMATCH`, `INSUFFICIENT_STOCK`.

Además, 008 añade la FK compuesta `movements_tenant_user_fk (establishment_id, user_id) → users (establishment_id, id)` **solo si los datos existentes son consistentes**. Si hay usuarios heredados sin establecimiento, la migración avisa y omite la FK; hay que asignarlos explícitamente y volver a ejecutarla.

## 4. Aislamiento multiempresa

### Contexto de sesión

El backend valida el JWT (`pv` y `est`) contra la base antes de ejecutar nada y escribe dos GUCs por transacción con `set_config(..., true)` dentro de `BEGIN`/`COMMIT`:

- `app.current_establishment_id`: leído por `fn_app_establishment_id()`.
- `app.current_role`: leído por `fn_app_is_superadmin()` y `fn_app_is_system()`.

`AsyncLocalStorage` mantiene el contexto de cada petición, de modo que peticiones concurrentes nunca comparten GUC en una conexión del pool. El `tenant_id` enviado por el cliente se ignora.

### Defaults y unicidad

La migración 007 define `fn_app_establishment_id()` como default de `establishment_id` en categorías, proveedores, productos, relaciones producto-proveedor, movimientos, ajustes de alerta y ajustes globales; `users` y `audit_log` también lo usan pero admiten `NULL` para la cuenta global. `users.email` sigue siendo único globalmente (login sin selección de empresa); código de producto, nombre de categoría, NIT de proveedor y `source_key` son únicos **por establecimiento**.

### Row Level Security

`categories`, `suppliers`, `products`, `product_suppliers`, `inventory_movements` y `product_alert_settings` tienen `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY` con la política `tenant_isolation`:

```sql
USING      (fn_app_is_system() OR establishment_id = fn_app_establishment_id())
WITH CHECK (fn_app_is_system() OR establishment_id = fn_app_establishment_id())
```

`users`, `audit_log` y `system_settings` permiten además `fn_app_is_superadmin()`; `establishments` permite al superadministrador ver todas las filas y a un tenant solo la suya. `fn_app_is_system()` es el **único** bypass global y se reserva para tareas internas del backend (login, creación con administrador, etc.), nunca para tokens de usuario.

### Defensa en profundidad en la aplicación

Como el rol de conexión puede ser dueño de las tablas, todos los repositorios añaden un predicado SQL explícito derivado del GUC (`tenantPredicate`: `fn_app_is_system() OR <alias>.establishment_id = fn_app_establishment_id()`), incluso en `UPDATE` y `DELETE`. Los JOIN exigen además `establishment_id` coincidente. Esta misma capa filtra reportes, indicadores y consultas del asistente IA. La vista `v_product_inventory` filtra por tenant, lee los ajustes de ese establecimiento e incluye `NOT fn_app_is_superadmin()`, de modo que el superadministrador no puede ver inventario ni siquiera indirectamente.

## 5. Vista `v_product_inventory`

Columnas expuestas:

| Grupo | Columnas |
| --- | --- |
| Producto | `establishment_id`, `id`, `code`, `name`, `description`, `category_id`, `supplier_id`, `category_name`, `supplier_name`, `active`, `created_at`, `updated_at`, `last_movement_at` |
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

Esta vista es consumida por productos, alertas, dashboard, indicadores y reportes: es la única fuente de verdad del motor preventivo, siempre dentro del establecimiento autenticado.

## 6. Datos demostrativos

El seed demostrativo está **deshabilitado**. `database/seeds/001_demo.sql` se conserva solo como referencia histórica y `backend/src/scripts/seed.js` finaliza con un aviso sin crear usuarios, contraseñas ni datos. No hay credenciales demo en la documentación ni en las pruebas.

Cada establecimiento se crea desde el panel `/superadmin`, preferiblemente con `POST /api/establishments/with-admin` para crear junto a él su cuenta de administrador. Los administradores iniciales se gestionan desde el panel; las pruebas automatizadas usan variables `TEST_*`/`E2E_*` del entorno contra un fixture local desechable, nunca credenciales fijas.

## 7. Datos usados por el asistente IA

`GET /api/ia/insights` consulta `v_product_inventory` y agrupa `inventory_movements` de tipo `OUT` por producto y día, siempre con el predicado de tenant. Es un cálculo local determinista en `backend/src/services/ai.service.js`: no crea tablas nuevas ni modifica el esquema.

El chat conversacional (`POST /api/ia/chat`) se construye con el mismo repositorio filtrado: envía a OpenAI un resumen agregado del establecimiento, sin SQL, claves ni secretos. No hay respuesta local como respaldo; sin clave, el chat informa que el asistente está temporalmente fuera de servicio.
