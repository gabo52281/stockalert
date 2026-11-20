# API REST

Base URL relativa: `/api` (el frontend siempre usa esta ruta). En desarrollo Vite la redirige a `http://localhost:<PORT>/api`, donde `PORT` se define en el único `.env` de la raíz (4000 por defecto). En Vercel Services, `/api` y `/api/*` se enrutan al servicio `backend` conservando el prefijo.

## 1. Formato de respuesta

```json
{
  "success": true,
  "data": { "...": "..." },
  "meta": { "page": 1, "limit": 10, "total": 10, "totalPages": 1 },
  "timestamp": "2026-11-20T..."
}
```

Errores:

```json
{
  "success": false,
  "error": { "code": "INSUFFICIENT_STOCK", "message": "Stock insuficiente para realizar la salida" },
  "timestamp": "2026-11-20T..."
}
```

Códigos habituales: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT`/`DUPLICATE_VALUE`/`INSUFFICIENT_STOCK` (409), `UNPROCESSABLE` (422), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

## 2. Autenticación

Envíe el token en la cabecera `Authorization: Bearer <token>`. El token se obtiene en `POST /auth/login`. `POST /auth/logout` revoca el `jti` del token; después de eso, cualquier uso del token devuelve 401.

## 3. Permisos por rol

| Rol | Permisos |
| --- | --- |
| `ADMINISTRADOR` | Todos (`*`) |
| `ENCARGADO_INVENTARIO` | Lectura/escritura de catálogos y movimientos, alertas, indicadores, dashboard y reportes; **no** administra usuarios |
| `CONSULTA` | Solo lectura de catálogos, movimientos, alertas, indicadores, dashboard, reportes y su propio perfil |

La matriz completa está en `backend/src/config/permissions.js` y se aplica en backend.

## 4. Endpoints

### Salud

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Estado de la API y conexión a PostgreSQL |

### Autenticación (`/api/auth`)

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| POST | `/login` | público | Iniciar sesión (limitado además por `authLimiter`) |
| POST | `/logout` | autenticado | Revocar token |
| GET | `/me` | autenticado | Usuario actual |
| PATCH | `/password` | autenticado | Cambiar contraseña propia |

### Usuarios (`/api/users`)

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/` | `profile:read` |
| GET | `/:id` | `profile:read` |
| POST | `/` | rol `ADMINISTRADOR` |
| PATCH | `/:id` | rol `ADMINISTRADOR` |
| PATCH | `/:id/active` | rol `ADMINISTRADOR` |
| PATCH | `/:id/password` | rol `ADMINISTRADOR` |

### Categorías (`/api/categories`)

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/`, `/:id` | `categories:read` |
| POST | `/` | `categories:create` |
| PATCH | `/:id`, `/:id/active` | `categories:update` / `categories:deactivate` |
| DELETE | `/:id` | `categories:delete` |

### Proveedores (`/api/suppliers`)

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/`, `/:id`, `/:id/products` | `suppliers:read` |
| POST | `/` | `suppliers:create` |
| PATCH | `/:id`, `/:id/active` | `suppliers:update` / `suppliers:deactivate` |
| DELETE | `/:id` | `suppliers:delete` |

### Productos (`/api/products`)

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| GET | `/` | `products:read` | Lista paginada; filtros `q`, `categoryId`, `supplierId`, `status`, `alertLevel`, `sortBy`, `sortDir`, `page`, `limit` |
| GET | `/:id` | `products:read` | Detalle con alerta y cobertura |
| GET | `/:id/movements` | `products:read` | Historial del producto |
| POST | `/` | `products:create` | Crear con stock 0 |
| PATCH | `/:id` | `products:update` | Editar datos |
| PATCH | `/:id/active` | `products:deactivate` | Activar/desactivar |
| PATCH | `/:id/alert-settings` | `products:update` | Porcentaje y ventanas por producto |
| DELETE | `/:id` | `products:delete` | Eliminar si no hay historial que lo impida |

### Movimientos (`/api/movements`)

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| GET | `/`, `/:id` | `movements:read` | Historial filtrable por tipo, producto, usuario y fechas |
| POST | `/in` | `movements:create` | Entrada; incrementa stock |
| POST | `/out` | `movements:create` | Salida; requiere `reason` y stock suficiente |

Ejemplo de salida:

```bash
curl -X POST http://localhost:4000/api/movements/out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"productId":21,"quantity":3,"reason":"Venta mostrador"}'
```

Respuesta (fragmento): `data.movement.stock_before`, `data.movement.stock_after` y `data.product.quantity`.

### Alertas (`/api/alerts`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/summary` | Conteos `active_products`, `normal`, `low`, `critical`, `out_of_stock`, `attention` |
| GET | `/` | Lista paginada de productos en atención, con filtros |
| GET | `/:id` | Detalle de alerta y cobertura de un producto |

Todas requieren `alerts:read`.

### Indicadores (`/api/indicators`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/summary?days=30` | Unidades, valor, promedio y cobertura global |
| GET | `/coverage?days=30&page=1&limit=10` | Cobertura por producto |
| GET | `/top-products?days=30` | Productos con mayores salidas |

Todas requieren `indicators:read`.

### Panel (`/api/dashboard`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/?days=30` | `summary`, `alerts`, `series`, `distribution`, `recentMovements`, `topProducts`, `attentionProducts` |

Requiere `dashboard:read`.

### Reportes (`/api/reports`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/` | Catálogo de reportes |
| GET | `/:report?format=json|csv|pdf&...` | Generar reporte |

Reportes disponibles: `inventory`, `low-stock`, `critical`, `movements-in`, `movements-out`, `movements-range`, `movements-by-user`, `top-products`, `coverage`, `valuation`.

Filtros habituales: `from`, `to`, `productId`, `categoryId`, `userId`, `type`, `status`. CSV y PDF se devuelven como archivo adjunto (`Content-Disposition`); el CSV incluye BOM UTF-8 para Excel.

Requiere `reports:read` (y `reports:export` en la interfaz).

### Asistente IA (`/api/ia`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/insights?days=30&leadTimeDays=14&limit=8` | Análisis predictivo local: resumen, recomendaciones y anomalías |

Requiere `indicators:read`. La respuesta `data` contiene:

- `parameters`: ventana analizada, lead time y límite.
- `summary`: `analyzedProducts`, `replenishmentProducts`, `highRiskProducts`, `anomalyProducts`, `unitsToReplenish`, `estimatedPurchaseCost`.
- `narrative`: resumen en lenguaje natural generado en backend.
- `recommendations[]`: `code`, `name`, `stock`, `forecastDailyDemand`, `forecastConfidence`, `daysOfCover`, `expectedDemand`, `safetyStock`, `reorderPoint`, `suggestedQty`, `risk`, `priority`, `reason`.
- `anomalies[]`: productos con picos de salida atípicos y su `anomalyScore`.

El modelo es local y determinista (suavizado exponencial con tendencia, stock de seguridad y z-score). No hay llamadas a proveedores de IA externos.

## 5. Ejemplo completo

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@stockalert.local","password":"Demo1234!"}' | jq -r .data.token)

curl -s http://localhost:4000/api/alerts/summary \
  -H "Authorization: Bearer $TOKEN"
```
