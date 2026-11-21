# Arquitectura

## 1. Visión general

```text
Navegador (React SPA)
   │  Axios + token JWT en localStorage (pv/est), siempre a /api
   │  superadmin: panel /superadmin; tenant: inventario propio
   ▼
Vite proxy (dev)  o  Vercel rewrite (producción)
   │
   ▼
API Express (/api)  ←  servicio backend en Vercel Services
   │  authenticate valida usuario, password_version y establecimiento
   │  AsyncLocalStorage → GUCs por transacción → tenantPredicate en repositorios
   │  Zod → permisos → servicios → repositorios
   ▼
Neon PostgreSQL
   │  RLS/FORCE RLS + FK compuestas + fn_register_movement() + v_product_inventory
   ▼
Alertas, cobertura, dashboard, reportes, insights locales y chat IA
```

La SPA no calcula existencias: representa lo que devuelve la API. La API no calcula por su cuenta el estado de alerta: lo lee de `v_product_inventory`. Los insights predictivos son un cálculo local determinista sobre esa vista y el historial real de movimientos; el chat envía un contexto agregado del mismo tenant a OpenRouter gratuito. Así, pantallas, reportes e IA coinciden con la base de datos.

No hay PostgreSQL local, Docker ni base de datos alternativa como dependencia: la única base del proyecto es Neon. Para verificación se usa un fixture local desechable, sin credenciales demo.

## 2. Backend por capas

| Capa | Directorio | Responsabilidad |
| --- | --- | --- |
| Rutas | `src/modules/<dominio>/*.routes.js` | Declarar endpoints, aplicar `authenticate`, `authorize`, `requireRole` y `validate` |
| Controladores | `src/controllers/` | Leer `req.validated`, llamar servicios, devolver envelope `ok()` |
| Servicios | `src/services/` | Reglas de negocio, transacciones, CSV/PDF, insights locales y chat IA |
| Repositorios | `src/repositories/` | SQL parametrizado con predicado de tenant, sin lógica de presentación |
| Middlewares | `src/middlewares/` | Auth, permisos, Zod, rate limit, errores, auditoría, logger |
| Configuración | `src/config/` | Entorno, pool `pg`, matriz de permisos, contexto de tenant |
| Scripts | `src/scripts/` | Migraciones, creación de administrador y promoción a superadmin |

Módulos: `auth`, `users`, `establishments`, `categories`, `suppliers`, `products`, `movements`, `alerts`, `indicators`, `dashboard`, `reports` e `ia`.

### Flujo de una petición

1. Helmet, CORS, compresión, logger y limitador general.
2. `authenticate` verifica el JWT (`jti` no revocado), consulta el usuario real con `runAsSystem`, comprueba que esté activo, que `pv` coincida con `password_version` y que su establecimiento esté activo (excepto en el SUPERADMINISTRADOR).
3. `authorize(permiso)` o `authorize.requireRole(rol)` comprueba la matriz del backend; la gestión de cuentas exige rol `SUPERADMINISTRADOR`.
4. `validate(schema)` valida `body`, `query` y `params` con Zod; expone `req.validated`.
5. El contexto `{ role, establishmentId }` viaja en `AsyncLocalStorage`; `query()` y `transaction()` hacen `BEGIN`, `set_config('app.current_role'|'app.current_establishment_id', ..., true)` y `COMMIT`/`ROLLBACK`.
6. El controlador llama al servicio; este al repositorio; las consultas usan siempre placeholders `$1, $2…` y el predicado de tenant.
7. `ok(res, data, meta, status)` envuelve la respuesta. Los errores se normalizan en `errorHandler`, que traduce códigos PostgreSQL (23505, 23503, 23514, 22023, P0002).

## 3. Frontend por capas

| Capa | Directorio | Responsabilidad |
| --- | --- | --- |
| API | `src/api/client.js`, `endpoints.js` | Axios con `baseURL: '/api'`, interceptor de token, `unwrap()` y `superadminApi` |
| Contexto | `src/context/` | Sesión (`AuthContext`), notificaciones (`ToastContext`) |
| Hooks | `src/hooks/` | `useApi` (carga/error/recarga) y `useDebounce` |
| Componentes | `src/components/` | Layout, tabla, paginación, modales, gráficas |
| Páginas | `src/pages/` | Una pantalla por módulo, incluidas `AiInsightsPage` y `SuperadminPage` |
| Rutas | `src/routes/AppRouter.jsx` | Rutas públicas, protegidas, por permiso y `/superadmin` |
| Estilos | `src/styles/` | Tokens CSS, layout, componentes y páginas; responsive |

El build separa React, Recharts e iconos en chunks propios. La SPA usa `/api` de forma relativa:

- Desarrollo: Vite proxya `/api` y `/health` hacia `http://localhost:${PORT}` (4000 por defecto).
- Producción en Vercel Services: el mismo dominio enruta `/api` y `/api/*` al servicio `backend` sin quitar el prefijo; no hay URLs absolutas ni `VITE_API_URL`.
- Verificación local del artefacto: `npm run build && npm start` sirve API y SPA en un solo puerto.

El frontend puede enviar un `establishmentId` solo en los formularios de administración de cuentas del panel superadmin; en las operaciones de inventario el tenant del token es la única fuente. Un `tenant_id` del cliente nunca decide el aislamiento.

### Convención de respuesta en el frontend

`endpoints.js` aplica `unwrap`, por lo que:

- Los endpoints **paginados** (`productsApi.list`, `usersApi.list`, `superadminApi.establishments`, etc.) devuelven el cuerpo completo `{ success, data, meta }`; las páginas usan `data?.data` y `data?.meta`.
- Los endpoints de **payload** (`dashboardApi.get`, `alertsApi.summary`, `reportsApi.get`, `aiApi.insights`, `superadminApi.stats`) devuelven directamente `data`, y las páginas acceden a sus campos (`summary`, `series`, `columns`, `rows`, `recommendations`).

## 4. Contexto multiempresa y aislamiento

### Roles y panel de administración

| Rol | Alcance |
| --- | --- |
| `SUPERADMINISTRADOR` | Panel `/superadmin`: establecimientos, cuentas y estadísticas de administración. **Sin inventario ni IA.** |
| `ADMINISTRADOR` | Inventario completo en su establecimiento; no administra cuentas |
| `ENCARGADO_INVENTARIO` | Inventario completo en su establecimiento; no administra cuentas |
| `CONSULTA` | Solo lectura en su establecimiento y de su propio perfil |

`AuthContext` envía al superadministrador a `/superadmin` y al resto a la pantalla de inventario. `GET /api/establishments` (CRUD, `activate/deactivate`, `users`, `stats`, `with-admin`) y `GET/PATCH /api/users` (filtros por establecimiento y reset de contraseña) son exclusivos del superadministrador. `users.email` es único globalmente; el resto de códigos únicos (producto, categoría, proveedor, `source_key`) son por establecimiento.

### Flujo del contexto de tenant

1. El login emite un JWT con `pv` (`password_version`) y `est` (`establishment_id`).
2. Cada petición autenticada valida el token contra la base de datos: usuario real, contraseña vigente, establecimiento activo y token no revocado.
3. `authenticate` ejecuta el resto de la cadena dentro de `runWithContext({ role, establishmentId })`.
4. Cada `query()`/`transaction()` reserva una conexión, aplica los GUCs con `set_config(..., true)` y los descarta al hacer `COMMIT`/`ROLLBACK`.
5. SQL usa `fn_app_establishment_id()` y las policies RLS de PostgreSQL; los repositorios añaden además `tenantPredicate`.

### Aislamiento en repositorios, reportes e IA

- Los repositorios de catálogos, productos, movimientos y analítica incluyen `tenantPredicate` en `SELECT`, `UPDATE` y `DELETE`, y exigen `establishment_id` igual en los JOIN.
- Reportes, dashboard, alertas e indicadores consumen esos mismos repositorios y la vista `v_product_inventory`, que filtra por tenant y por los ajustes de ese establecimiento.
- `ai.repository.js` carga solo productos y movimientos del establecimiento autenticado; el contexto agregado del chat se construye con esas cifras y nunca con SQL, claves ni secretos.
- `fn_app_is_system()` es el único bypass global y se usa solo en tareas internas del backend (por ejemplo, login o creación de establecimiento con administrador), nunca desde un token de usuario.

### ¿Por qué el superadministrador no ve inventario?

Es una decisión de defensa en profundidad: el superadministrador no tiene `establishment_id`, y las políticas RLS de inventario no contemplan `fn_app_is_superadmin()`. La vista añade `NOT fn_app_is_superadmin()` y su matriz de permisos excluye productos, movimientos, alertas, indicadores, reportes e IA. Así puede crear empresas y cuentas sin leer el inventario privado de ninguna de ellas; incluso si un repositorio olvidara su filtro, la base de datos seguiría bloqueando la lectura.

## 5. Motor de alertas

Fuente: `database/migrations/004_inventory_view.sql`, reconstruida por la migración 005 con filtro de establecimiento (`v_product_inventory`).

Variables efectivas por producto (configuración propia si existe; si no, ajuste del establecimiento):

- `effective_percentage` (por defecto 25 %).
- `effective_window_days` (por defecto 30 días).
- `effective_min_history_days` (por defecto 7 días).

Umbral preventivo: `min_stock * (1 + effective_percentage / 100)`.

| Estado | Regla |
| --- | --- |
| `AGOTADO` | `quantity = 0` |
| `CRITICO` | `0 < quantity <= min_stock` |
| `BAJO` | `min_stock < quantity <= umbral preventivo` |
| `NORMAL` | el resto (incluye `min_stock = 0` con stock positivo) |

## 6. Indicador de cobertura

- `out_units_window`: unidades salidas en la ventana.
- `avg_daily_out = out_units_window / effective_window_days`.
- `coverage_days = ROUND(quantity / avg_daily_out, 2)` solo si el estado es `CALCULABLE`.
- `coverage_status`:
  - `NO_CALCULABLE`: no hay salidas en la ventana.
  - `INSUFICIENTE`: la primera salida de la ventana es más reciente que `min_history_days`.
  - `CALCULABLE`: hay historial suficiente y salidas.

La interfaz muestra «Sin datos suficientes» o «No calculable» en lugar de un número inventado. La vista además expone `inventory_value` e `inventory_sale_value`.

## 7. Movimientos y concurrencia

Toda entrada o salida llama a `fn_register_movement(...)` dentro de una transacción:

1. Valida cantidad > 0, tipo `IN`/`OUT` y motivo obligatorio en salidas.
2. Bloquea el producto con `SELECT … FOR UPDATE`, restringido al tenant validado.
3. Verifica que el producto exista, esté activo y pertenezca al establecimiento.
4. Comprueba que el usuario y el proveedor indicados pertenezcan al mismo establecimiento (`USER_TENANT_MISMATCH`, `SUPPLIER_TENANT_MISMATCH`).
5. Calcula `stock_after = stock_before ± quantity`; si es negativo, lanza `INSUFFICIENT_STOCK`.
6. Actualiza `products.quantity` y `last_movement_at`, e inserta el movimiento con el `establishment_id` derivado del producto, usuario, fecha y `source_key` opcional (idempotencia por tenant).

No existen endpoints para editar o borrar movimientos: el historial es inmutable por diseño de aplicación. Las FK compuestas y la FK condicional movimientos-usuario de la migración 008 refuerzan esta integridad en la base de datos.

## 8. Asistente IA

`GET /api/ia/insights` reúne productos activos de `v_product_inventory` y salidas agrupadas por día de `inventory_movements`, filtrados por establecimiento. El servicio local:

1. Rellena días sin movimientos con cero para construir una serie continua.
2. Estima demanda diaria con suavizado exponencial y tendencia atenuada.
3. Calcula volatilidad, stock de seguridad y punto de pedido para el `leadTimeDays` solicitado.
4. Deriva cobertura, riesgo, prioridad y una razón explicable por producto.
5. Detecta anomalías comparando el último día contra la media y desviación previas.
6. Devuelve un resumen y una narrativa generados en backend.

`POST /api/ia/chat` es distinto: **no tiene respuesta local ni proveedor de pago como respaldo**. Tras el consentimiento explícito del usuario, envía a la API de OpenRouter el modelo gratuito `openrouter/free`, valida `usage.cost = 0` y un modelo `:free`, y genera el texto solo con un resumen agregado del tenant. Sin consentimiento, sin `OPENROUTER_API_KEY` o ante cuota/timeout/error, responde que la IA está temporalmente fuera de servicio. El contexto nunca incluye SQL, claves ni secretos. Las alertas oficiales siguen siendo las de la vista SQL; el IA es complementario y no crea órdenes de compra.

## 9. Seguridad transversal

- Contraseñas con bcrypt (factor 12); el reset incrementa `password_version` e invalida tokens anteriores.
- JWT firmado, con `jti`, `pv` y `est`, y revocación en `revoked_tokens`.
- Permisos verificados en backend; el frontend solo oculta botones. La cuenta superadministrador y la gestión de usuarios están fuera del alcance de los roles de inventario.
- Consultas parametrizadas, transacciones con GUCs por petición, RLS/FORCE RLS y predicados explícitos; Helmet, CORS restringido, rate limiting y manejo de errores sin trazas internas en producción.
- El tenant se deriva del token validado; un `tenant_id` del frontend no altera el aislamiento.
- El frontend nunca recibe `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` ni `OPENROUTER_API_KEY`; la clave del modelo gratuito vive solo en el backend/Vercel.

## 10. Conexiones con Neon

| Uso | URL | Por qué |
| --- | --- | --- |
| API y scripts de datos | pooler (`-pooler` en el hostname) | PgBouncer en modo transacción soporta muchas conexiones cortas |
| Migraciones | directa (sin `-pooler`) | DDL, extensiones y `schema_migrations` requieren conexión directa |

`backend/src/config/poolConfig.js` centraliza la construcción del pool, fuerza TLS con verificación de certificado para dominios `neon.tech` y deriva la URL directa desde la pooler si `DIRECT_URL` no está definida. El pool de la API usa `max: 5`; el de migraciones, `max: 1` y `pg_advisory_lock`. Las migraciones 005–008 requieren autorización antes de aplicarse en Neon.

## 11. Arranque y despliegue

- `npm run dev` valida el `.env` raíz, ejecuta migraciones pendientes, inicia API y Vite y abre el navegador.
- `npm run build` compila únicamente la SPA. Las migraciones se ejecutan con `npm run migrate` o desde el build del servicio backend en Vercel; en Neon solo con autorización previa.
- `backend/api/index.js` exporta la app Express y es el entrypoint del servicio `backend`. `server.js` (que sí llama a `listen()`) solo se usa en desarrollo local y en `npm start`.
- `vercel.json` define los servicios `backend` y `frontend`, enruta `/api`, `/api/*` y `/health` al backend, envía el resto al frontend y declara el fallback a `/index.html` dentro del servicio frontend para React Router.
- Cada servicio instala y compila sus dependencias de forma independiente; npm detecta el workspace raíz del repositorio desde cada servicio. No hay service bindings: el navegador usa `/api` en el mismo dominio.

Detalles de seguridad en [`seguridad.md`](seguridad.md) y de despliegue en [`instalacion.md`](instalacion.md).
