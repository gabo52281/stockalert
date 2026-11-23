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

El JWT incluye `sub`, `email`, `role`, `jti`, `pv` (`password_version`) y `est` (establecimiento). En cada petición el backend vuelve a leer el usuario real, comprueba que siga activo, que `pv` coincida con su `password_version`, que el `jti` no esté revocado y, salvo para el `SUPERADMINISTRADOR`, que su establecimiento esté activo.

**El establecimiento de la petición se toma siempre del token validado.** Cualquier `tenant_id` o `establishmentId` enviado por el frontend se ignora: el backend propaga el contexto con `AsyncLocalStorage`, lo escribe en GUCs por transacción y lo refuerza con RLS y predicados SQL explícitos en los repositorios.

## 3. Permisos por rol

| Rol | Permisos |
| --- | --- |
| `SUPERADMINISTRADOR` | Administración global: establecimientos, cuentas, estadísticas de administración y perfil; **sin inventario ni IA** |
| `ADMINISTRADOR` | Inventario completo dentro de su establecimiento: catálogos, movimientos, alertas, indicadores, dashboard, reportes y perfil; no administra cuentas |
| `ENCARGADO_INVENTARIO` | Las mismas operaciones de inventario que `ADMINISTRADOR`, limitadas a su establecimiento; no administra cuentas |
| `CONSULTA` | Solo lectura de catálogos, movimientos, alertas, indicadores, dashboard, reportes y su propio perfil, dentro de su establecimiento |

Los permisos globales son `establishments:*`, `users:*`, `admin-stats:read` y `profile:*`. La matriz completa está en `backend/src/config/permissions.js` y se aplica siempre en backend; el frontend solo oculta controles. La gestión de cuentas es exclusiva del superadministrador.

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
| GET | `/me` | autenticado | Usuario actual (incluye `establishmentId`) |
| PATCH | `/password` | autenticado | Cambiar contraseña propia |

### Establecimientos (`/api/establishments`)

Todas las rutas requieren autenticación; la gestión es exclusiva del superadministrador y el panel correspondiente es `/superadmin`.

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| GET | `/stats` | `admin-stats:read` | Estadísticas de administración (establecimientos y cuentas), no inventario |
| GET | `/` | `establishments:read` | Lista paginada; filtros `q`, `active`, `page`, `limit` |
| POST | `/` | rol `SUPERADMINISTRADOR` | Crear establecimiento y sus ajustes por defecto |
| POST | `/with-admin` | rol `SUPERADMINISTRADOR` | Crear establecimiento y su administrador en una transacción |
| GET | `/:id` | `establishments:read` | Detalle del establecimiento |
| GET | `/:id/users` | `users:read` | Usuarios asignados al establecimiento |
| PATCH | `/:id` | rol `SUPERADMINISTRADOR` | Editar datos del establecimiento |
| PATCH | `/:id/active` | rol `SUPERADMINISTRADOR` | Activar/desactivar (`{ "active": boolean }`) |

`POST /with-admin` recibe `{ "establishment": { ... }, "admin": { "name": ..., "email": ..., "password": ... } }`. No existen endpoints para borrar establecimientos: la desactivación bloquea el login de sus usuarios.

### Usuarios (`/api/users`)

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| GET | `/` | `users:read` | Lista paginada; filtros `q`, `role`, `active`, `establishmentId`, `page`, `limit` |
| GET | `/options` | `movements:read` o `reports:read` | Solo `{ id, name }` de usuarios activos del establecimiento autenticado, para filtros; no expone correos, roles ni administración |
| GET | `/:id` | `users:read` | Detalle de usuario |
| POST | `/` | rol `SUPERADMINISTRADOR` | Crear usuario con `establishmentId` y rol `ADMINISTRADOR`, `ENCARGADO_INVENTARIO` o `CONSULTA` |
| PATCH | `/:id` | rol `SUPERADMINISTRADOR` | Editar usuario y su establecimiento |
| PATCH | `/:id/active` | rol `SUPERADMINISTRADOR` | Activar/desactivar (`{ "active": boolean }`) |
| PATCH | `/:id/password` | rol `SUPERADMINISTRADOR` | Restablecer contraseña (`{ "password": ... }`) y exigir cambio en el próximo login |

`users.email` es único globalmente, porque el login no pide seleccionar empresa. No se pueden crear ni modificar cuentas `SUPERADMINISTRADOR` desde estos endpoints: esa promoción es explícita y queda fuera del panel. Un restablecimiento incrementa `password_version`, por lo que los tokens anteriores dejan de ser válidos.

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

Todas requieren `alerts:read` y devuelven únicamente datos del establecimiento del token.

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

Requiere `reports:read` (y `reports:export` en la interfaz). Los reportes usan los mismos repositorios filtrados por establecimiento que el resto de la API.

### Asistente IA (`/api/ia`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/insights?days=30&leadTimeDays=14&limit=8` | Cálculo local determinista de indicadores: resumen, recomendaciones y anomalías |
| GET | `/status` | Disponibilidad del modelo externo y modo del chat |
| POST | `/chat` | Chat conversacional con OpenAI; sin consentimiento previo |

Las tres requieren `indicators:read` y solo devuelven datos del establecimiento del token. La respuesta de `GET /insights` contiene:

- `parameters`: ventana analizada, lead time y límite.
- `summary`: `analyzedProducts`, `replenishmentProducts`, `highRiskProducts`, `anomalyProducts`, `unitsToReplenish`, `estimatedPurchaseCost`.
- `narrative`: resumen en lenguaje natural generado en backend.
- `recommendations[]`: `code`, `name`, `stock`, `forecastDailyDemand`, `forecastConfidence`, `daysOfCover`, `expectedDemand`, `safetyStock`, `reorderPoint`, `suggestedQty`, `risk`, `priority`, `reason`.
- `anomalies[]`: productos con picos de salida atípicos y su `anomalyScore`.

Los insights son un cálculo local determinista (suavizado exponencial con tendencia, stock de seguridad y z-score), disponibles por API aunque la interfaz del módulo muestre solo el chat. En cambio, **el chat usa OpenAI** (`OPENAI_MODEL`, por defecto `gpt-5.6-luna`) con un prompt de prosa natural sin Markdown y sin respuesta local de respaldo. `POST /chat` acepta `question` (2–500 caracteres), `days`, `leadTimeDays` y `history` (máximo 8 mensajes), y está limitado a 12 peticiones por minuto por usuario. El contexto enviado es agregado y perteneciente al tenant: nunca incluye SQL, claves ni secretos. Sin clave configurada, o ante cuota/timeout/error del proveedor, el chat informa que el asistente está temporalmente fuera de servicio.

## 5. Ejemplo completo

Use credenciales propias desde variables de entorno; el repositorio no contiene cuentas ni contraseñas de demostración:

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$STOCKALERT_EMAIL\",\"password\":\"$STOCKALERT_PASSWORD\"}" | jq -r .data.token)

curl -s http://localhost:4000/api/alerts/summary \
  -H "Authorization: Bearer $TOKEN"
```

Las pruebas automatizadas emplean variables `TEST_*` y `E2E_*` del entorno contra un fixture local desechable; no hay credenciales demo en documentación ni en tests.
