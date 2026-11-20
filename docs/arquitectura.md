# Arquitectura

## 1. Visión general

```text
Navegador (React SPA)
   │  Axios + token JWT en localStorage, siempre a /api
   ▼
Vite proxy (dev)  o  Vercel rewrite (producción)
   │
   ▼
API Express (/api)  ←  servicio backend en Vercel Services
   │  Zod → permisos → servicios → repositorios
   ▼
Neon PostgreSQL
   │  tablas + fn_register_movement() + v_product_inventory
   ▼
Alertas, cobertura, dashboard, reportes y asistente IA
```

La SPA no calcula existencias: representa lo que devuelve la API. La API no calcula por su cuenta el estado de alerta: lo lee de `v_product_inventory`. El Asistente IA también consulta esa vista y el historial real de movimientos. Así, pantallas, reportes e insights coinciden con la base de datos.

No hay PostgreSQL local, Docker ni base de datos alternativa: la única base del proyecto es Neon.

## 2. Backend por capas

| Capa | Directorio | Responsabilidad |
| --- | --- | --- |
| Rutas | `src/modules/<dominio>/*.routes.js` | Declarar endpoints, aplicar `authenticate`, `authorize` y `validate` |
| Controladores | `src/controllers/` | Leer `req.validated`, llamar servicios, devolver envelope `ok()` |
| Servicios | `src/services/` | Reglas de negocio, transacciones, CSV/PDF y modelo IA local |
| Repositorios | `src/repositories/` | SQL parametrizado, sin lógica de presentación |
| Middlewares | `src/middlewares/` | Auth, permisos, Zod, rate limit, errores, auditoría, logger |
| Configuración | `src/config/` | Entorno validado, pool `pg`, matriz de permisos |
| Scripts | `src/scripts/` | Migraciones, seed y creación de administrador |

Módulos: `auth`, `users`, `categories`, `suppliers`, `products`, `movements`, `alerts`, `indicators`, `dashboard`, `reports` e `ia`.

### Flujo de una petición

1. Helmet, CORS, compresión, logger y limitador general.
2. `authenticate` verifica el JWT (`jti` no revocado) y carga usuario + rol.
3. `authorize(permiso)` o `authorize.requireRole(rol)` comprueba la matriz del backend.
4. `validate(schema)` valida `body`, `query` y `params` con Zod; expone `req.validated`.
5. El controlador llama al servicio; este al repositorio; las consultas usan siempre placeholders `$1, $2…`.
6. `ok(res, data, meta, status)` envuelve la respuesta. Los errores se normalizan en `errorHandler`, que traduce códigos PostgreSQL (23505, 23503, 23514, 22023, P0002).

## 3. Frontend por capas

| Capa | Directorio | Responsabilidad |
| --- | --- | --- |
| API | `src/api/client.js`, `endpoints.js` | Axios con `baseURL: '/api'`, interceptor de token y `unwrap()` |
| Contexto | `src/context/` | Sesión (`AuthContext`), notificaciones (`ToastContext`) |
| Hooks | `src/hooks/` | `useApi` (carga/error/recarga) y `useDebounce` |
| Componentes | `src/components/` | Layout, tabla, paginación, modales, gráficas |
| Páginas | `src/pages/` | Una pantalla por módulo, incluida `AiInsightsPage` |
| Rutas | `src/routes/AppRouter.jsx` | Rutas públicas, protegidas y por permiso |
| Estilos | `src/styles/` | Tokens CSS, layout, componentes y páginas; responsive |

El build separa React, Recharts e iconos en chunks propios. La SPA usa `/api` de forma relativa:

- Desarrollo: Vite proxya `/api` y `/health` hacia `http://localhost:${PORT}` (4000 por defecto).
- Producción en Vercel Services: el mismo dominio enruta `/api` y `/api/*` al servicio `backend` sin quitar el prefijo; no hay URLs absolutas ni `VITE_API_URL`.
- Verificación local del artefacto: `npm run build && npm start` sirve API y SPA en un solo puerto.

### Convención de respuesta en el frontend

`endpoints.js` aplica `unwrap`, por lo que:

- Los endpoints **paginados** (`productsApi.list`, `usersApi.list`, etc.) devuelven el cuerpo completo `{ success, data, meta }`; las páginas usan `data?.data` y `data?.meta`.
- Los endpoints de **payload** (`dashboardApi.get`, `alertsApi.summary`, `reportsApi.get`, `aiApi.insights`) devuelven directamente `data`, y las páginas acceden a sus campos (`summary`, `series`, `columns`, `rows`, `recommendations`).

## 4. Motor de alertas

Fuente: `database/migrations/004_inventory_view.sql` (`v_product_inventory`).

Variables efectivas por producto (configuración propia si existe; si no, ajuste global):

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

## 5. Indicador de cobertura

- `out_units_window`: unidades salidas en la ventana.
- `avg_daily_out = out_units_window / effective_window_days`.
- `coverage_days = ROUND(quantity / avg_daily_out, 2)` solo si el estado es `CALCULABLE`.
- `coverage_status`:
  - `NO_CALCULABLE`: no hay salidas en la ventana.
  - `INSUFICIENTE`: la primera salida de la ventana es más reciente que `min_history_days`.
  - `CALCULABLE`: hay historial suficiente y salidas.

La interfaz muestra «Sin datos suficientes» o «No calculable» en lugar de un número inventado. La vista además expone `inventory_value` e `inventory_sale_value`.

## 6. Movimientos y concurrencia

Toda entrada o salida llama a `fn_register_movement(...)` dentro de una transacción:

1. Valida cantidad > 0, tipo `IN`/`OUT` y motivo obligatorio en salidas.
2. `SELECT quantity, active … FROM products WHERE id = … FOR UPDATE` bloquea la fila.
3. Verifica que el producto exista y esté activo.
4. Calcula `stock_after = stock_before ± quantity`; si es negativo, lanza `INSUFFICIENT_STOCK`.
5. Actualiza `products.quantity` y `last_movement_at`.
6. Inserta el movimiento con `stock_before`, `stock_after`, usuario, fecha y `source_key` opcional (idempotencia).

No existen endpoints para editar o borrar movimientos: el historial es inmutable por diseño de aplicación.

## 7. Asistente IA local

`GET /api/ia/insights` reúne productos activos de `v_product_inventory` y salidas agrupadas por día de `inventory_movements`. El servicio:

1. Rellena días sin movimientos con cero para construir una serie continua.
2. Estima demanda diaria con suavizado exponencial y tendencia atenuada.
3. Calcula volatilidad, stock de seguridad y punto de pedido para el `leadTimeDays` solicitado.
4. Deriva cobertura, riesgo, prioridad y una razón explicable por producto.
5. Detecta anomalías comparando el último día contra la media y desviación previas.
6. Devuelve un resumen y una narrativa generados en backend.

No hay proveedor externo, clave de API ni almacenamiento de datos fuera de Neon. Las alertas oficiales siguen siendo las de la vista SQL; el IA es complementario y no crea órdenes de compra.

## 8. Seguridad transversal

- Contraseñas con bcrypt (factor 12).
- JWT firmado, con `jti` y revocación en `revoked_tokens`.
- Permisos verificados en backend; el frontend solo oculta botones.
- Consultas parametrizadas y transacciones; Helmet, CORS restringido, rate limiting y manejo de errores sin trazas internas en producción.
- El frontend nunca recibe `DATABASE_URL`, `DIRECT_URL` ni `JWT_SECRET`.

## 9. Conexiones con Neon

| Uso | URL | Por qué |
| --- | --- | --- |
| API y scripts de datos | pooler (`-pooler` en el hostname) | PgBouncer en modo transacción soporta muchas conexiones cortas |
| Migraciones | directa (sin `-pooler`) | DDL, extensiones y `schema_migrations` requieren conexión directa |

`backend/src/config/poolConfig.js` centraliza la construcción del pool, fuerza TLS con verificación de certificado para dominios `neon.tech` y deriva la URL directa desde la pooler si `DIRECT_URL` no está definida. El pool de la API usa `max: 5`; el de migraciones, `max: 1` y `pg_advisory_lock`.

## 10. Arranque y despliegue

- `npm run dev` valida el `.env` raíz, ejecuta migraciones pendientes, inicia API y Vite y abre el navegador.
- `npm run build` compila únicamente la SPA. Las migraciones se ejecutan con `npm run migrate` o desde el build del servicio backend en Vercel.
- `backend/api/index.js` exporta la app Express y es el entrypoint del servicio `backend`. `server.js` (que sí llama a `listen()`) solo se usa en desarrollo local y en `npm start`.
- `vercel.json` define los servicios `backend` y `frontend`, enruta `/api`, `/api/*` y `/health` al backend, envía el resto al frontend y declara el fallback a `/index.html` dentro del servicio frontend para React Router.
- Cada servicio instala y compila sus dependencias de forma independiente; npm detecta el workspace raíz del repositorio desde cada servicio. No hay service bindings: el navegador usa `/api` en el mismo dominio.

Detalles de seguridad en [`seguridad.md`](seguridad.md) y de despliegue en [`instalacion.md`](instalacion.md).
