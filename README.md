# STOCKALERT

Sistema web de gestión y control de inventarios con alertas preventivas, indicadores, reportes y asistente IA local explicable.

## Estado actual

- **Una sola base de datos:** Neon (PostgreSQL administrado). No hay PostgreSQL embebido, contenedores de base de datos ni scripts locales de base de datos.
- **Un solo archivo de configuración:** `stockalert/.env`. El backend lo carga; el frontend nunca recibe secretos.
- **Un solo comando para desarrollar:** `npm run dev` valida la configuración, aplica migraciones pendientes, levanta la API, levanta Vite, configura `/api` y abre el navegador.
- **API relativa:** el frontend siempre llama a `/api`. Vite hace de proxy en desarrollo y Vercel enruta al mismo dominio en producción.
- **Despliegue:** un repositorio y un proyecto de Vercel Services con dos servicios: `backend` (Express) y `frontend` (Vite). No hay dominios ni despliegues separados.
- **IA incluida:** módulo `Asistente IA` con predicción de demanda, stock de seguridad, riesgo de reposición y detección de anomalías, calculado en backend con datos reales y sin enviar información a terceros.

## Requisitos

- Node.js 20 o superior.
- Una cuenta de Neon con una base de datos PostgreSQL ya creada.
- No se necesita Docker, PostgreSQL local ni `psql`.

## Puesta en marcha

```bash
cp .env.example .env
# Edite .env: pegue la URL pooler de Neon en DATABASE_URL y defina JWT_SECRET.
npm install
npm run admin       # opcional: crea el primer administrador real
npm run dev         # abre http://localhost:5173
```

El usuario administrador se crea con `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` del `.env`. Los datos de demostración (`admin@stockalert.local`, etc.) solo se cargan de forma explícita con `npm run seed` y están bloqueados cuando `NODE_ENV=production`.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm install` | Instala backend y frontend desde la raíz (workspaces). |
| `npm run dev` | Configura, migra, inicia API + Vite y abre el navegador. |
| `npm run build` | Compila la SPA; en Vercel aplica antes las migraciones pendientes. |
| `npm test` | Pruebas automáticas. Sin `DATABASE_URL` omit las integraciones y ejecuta las pruebas puras. |
| `npm run test:integration` | Solo pruebas con base de datos (requiere `DATABASE_URL`). |
| `npm run lint` | ESLint de backend y frontend. |
| `npm run migrate` / `migrate:status` | Aplicar/consultar migraciones de forma manual. |
| `npm run admin` | Crear o actualizar el primer administrador. |
| `npm run seed` | Cargar datos demo **solo en desarrollo**. |
| `npm start` | Servir API + SPA compilada en un solo puerto (útil para verificar el artefacto). |

## Variables de entorno

Todas van en `stockalert/.env`:

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | URL **pooler** de Neon (`-pooler` en el host). La usa la API. |
| `DIRECT_URL` | No | URL directa de Neon para DDL. Si falta, se deriva de `DATABASE_URL`. |
| `JWT_SECRET` | Sí | Cadena aleatoria de al menos 32 caracteres. |
| `JWT_EXPIRES_IN` | No | Vigencia del token, por defecto `8h`. |
| `CORS_ORIGIN` | No | Origen permitido. En desarrollo `http://localhost:5173`; en producción el dominio real. |
| `PORT` | No | Puerto de la API, por defecto `4000`. |
| `NODE_ENV` | No | `development`, `test` o `production`. |
| `DB_SSL` | No | TLS se activa automáticamente para Neon; útil solo para otra BD con TLS. |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` | No | Límites HTTP. |
| `SEED_ADMIN_*` | No | Datos para `npm run admin`. |
| `DEMO_PASSWORD` | No | Contraseña demo para `npm run seed`; nunca se usa en producción. |

No existe `VITE_API_URL`: el frontend usa `/api` de forma relativa.

## Funcionalidad preservada

- Autenticación JWT con revocación por `jti`, roles `ADMINISTRADOR`, `ENCARGADO_INVENTARIO` y `CONSULTA`, permisos verificados siempre en backend.
- Productos, categorías, proveedores, movimientos IN/OUT, historial, alertas, indicadores, dashboard, gráficas, usuarios y perfil.
- Reportes JSON/CSV/PDF generados en servidor, sin escribir archivos en disco.
- Fuente única de verdad SQL: `v_product_inventory` y `fn_register_movement()` con `SELECT ... FOR UPDATE`.
- Diseño responsive y validación de formularios con Zod.

## IA local

El módulo **Asistente IA** (`/ia`) calcula, con los movimientos ya registrados:

- Demanda diaria estimada mediante suavizado exponencial con tendencia atenuada.
- Stock de seguridad y punto de pedido para un lead time configurable (7/14/21/30 días).
- Días de cobertura, nivel de riesgo y priorización de acciones.
- Detección de picos atípicos (anomalías) y una narrativa resumida.
- Confianza de la estimación según la cantidad de días con historial.

Es un modelo **local, determinista y explicable**: no llama a proveedores externos ni expone datos sensibles. Las alertas oficiales de stock mínimo siguen calculándose en `v_product_inventory`.

## Migraciones

`npm run dev` y el build del servicio `backend` en Vercel ejecutan `node backend/src/scripts/migrate.js up` una sola vez por arranque/despliegue. El ejecutor:

- Registra versiones en `schema_migrations` y aplica únicamente archivos pendientes.
- Usa una transacción por migración y un bloqueo advisory para despliegues concurrentes.
- Usa la URL directa de Neon para DDL; nunca se ejecuta por petición HTTP.
- No elimina datos ni carga demo automáticamente.

Los archivos en `database/migrations/` y `database/seeds/` se conservan sin cambios.

## Despliegue en Vercel Services

1. Suba este repositorio a GitHub (sin `.env`; está ignorado).
2. En Vercel: **Add New → Project** e importe ese repositorio. Vercel detecta dos servicios; conserve los nombres `backend` y `frontend` y sus raíces `backend/` y `frontend/`.
3. Configure las variables de entorno del proyecto: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN=https://su-dominio.vercel.app` y `NODE_ENV=production`. Se inyectan por entorno; no se crea un `.env` en Vercel.
4. Despliegue. Cada servicio instala y compila sus dependencias de forma independiente:
   - `backend` exporta Express desde `backend/api/index.js` (sin `app.listen()`) y su build ejecuta las migraciones pendientes una sola vez por despliegue.
   - `frontend` compila la SPA en `frontend/dist` y sirve el fallback de React Router.
5. Cree el administrador apuntando a la misma BD de Neon con `npm run admin` desde una máquina que tenga el `.env` correspondiente.

`vercel.json` enruta `/api` y `/api/*` al servicio `backend` (sin quitar el prefijo), `/health` también al backend y el resto al servicio `frontend`. Recargar `/productos`, `/ia`, etc. funciona gracias al fallback definido dentro del servicio frontend. No se añadieron service bindings: el navegador llama a `/api` en el mismo dominio.

No se ha realizado un despliegue real en Vercel ni se ejecutaron migraciones en Neon desde este entorno: las verificaciones locales se detallan en [`docs/pruebas.md`](docs/pruebas.md).

## Estructura

```text
backend/                  API REST, servicios, repositorios, scripts
backend/api/index.js      entrada Express del servicio backend en Vercel
database/migrations/      DDL versionado (fuente de verdad)
database/seeds/           datos demo, nunca automáticos en producción
frontend/                 SPA React + Vite (servicio frontend)
scripts/                  orquestación de dev y build
vercel.json               definición de servicios y rewrites de Vercel Services
.env.example              única plantilla de configuración
```

## Documentación

- [`docs/instalacion.md`](docs/instalacion.md) — instalación y despliegue.
- [`docs/arquitectura.md`](docs/arquitectura.md) — capas, seguridad de stock y Neon.
- [`docs/base-datos.md`](docs/base-datos.md) — esquema, vista y función de movimientos.
- [`docs/api.md`](docs/api.md) — endpoints, incluido `/api/ia`.
- [`docs/manual-usuario.md`](docs/manual-usuario.md) — uso del asistente IA y del resto de módulos.
- [`docs/seguridad.md`](docs/seguridad.md) — secretos, roles y producción.
- [`docs/alcance.md`](docs/alcance.md) — alcance vigente.
- [`docs/pruebas.md`](docs/pruebas.md) — resultados reales de verificación.
