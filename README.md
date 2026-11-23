# STOCKALERT

Sistema web multiempresa de gestión y control de inventarios con alertas preventivas, indicadores, reportes y copiloto IA conversacional vía OpenRouter gratuito.

## Estado actual

- **Una sola base de datos:** Neon (PostgreSQL administrado), con aislamiento lógico por establecimiento. No hay PostgreSQL embebido, contenedores de base de datos ni scripts locales de base de datos.
- **Un solo archivo de configuración:** `stockalert/.env`. El backend lo carga; el frontend nunca recibe secretos.
- **Un solo comando para desarrollar:** `npm run dev` valida la configuración, aplica migraciones pendientes en base local, levanta la API, levanta Vite, configura `/api` y abre el navegador. En una BD no local las migraciones exigen autorización explícita.
- **API relativa:** el frontend siempre llama a `/api`. Vite hace de proxy en desarrollo y Vercel enruta al mismo dominio en producción.
- **Despliegue:** un repositorio y un proyecto de Vercel Services con dos servicios: `backend` (Express) y `frontend` (Vite). No hay dominios ni despliegues separados.
- **Arquitectura multiempresa:** `SUPERADMINISTRADOR` global + establecimientos aislados + usuarios por establecimiento + panel `/superadmin`. El superadministrador no tiene acceso a inventario ni a IA.
- **IA:** el módulo Asistente IA calcula indicadores en backend y su copiloto conversacional usa **solo OpenRouter gratuito** (`openrouter/free`, `usage.cost === 0`). Envía contexto agregado del establecimiento a OpenRouter únicamente tras consentimiento; sin clave o sin consentimiento muestra aviso de servicio no disponible. No hay fallback local ni de pago.

## Multiempresa (resumen)

| Rol | Alcance |
| --- | --- |
| `SUPERADMINISTRADOR` | Gestiona establecimientos y cuentas, y consulta estadísticas globales desde `/superadmin`. Sin acceso a inventario ni a IA. |
| `ADMINISTRADOR` | Inventario completo dentro de su establecimiento. No gestiona cuentas. |
| `ENCARGADO_INVENTARIO` | Inventario completo dentro de su establecimiento. No gestiona cuentas. |
| `CONSULTA` | Solo lectura dentro de su establecimiento. |

- El `establishment_id` se deriva del JWT validado en backend; se ignora cualquier `tenant_id` enviado por el frontend.
- Aislamiento con RLS/FORCE RLS mediante los GUCs `app.current_establishment_id` y `app.current_role`, más predicados SQL explícitos en los repositorios porque el rol de conexión puede ser dueño y omitir RLS. `fn_app_is_system()` es el único bypass.
- Los registros comerciales existentes se asociaron al establecimiento Principal (`id=1`); los usuarios existentes quedaron con `establishment_id` NULL hasta asignación o promoción explícita. No se borraron ni reasignaron datos por suposición.

## Requisitos

- Node.js 20 o superior.
- Una cuenta de Neon con una base de datos PostgreSQL ya creada.
- No se necesita Docker, PostgreSQL local ni `psql`.

## Puesta en marcha

```bash
cp .env.example .env
# Edite .env: pegue la URL pooler de Neon en DATABASE_URL y defina JWT_SECRET.
npm install
npm run admin       # opcional: crea la cuenta inicial real de un establecimiento
npm run dev         # abre http://localhost:5173
```

El usuario inicial se crea con `SEED_ADMIN_*` del `.env` (incluido `SEED_ADMIN_ESTABLISHMENT_ID`). `npm run seed` está deshabilitado: no carga datos demo ni credenciales; el SQL antiguo se conserva solo como referencia histórica. La promoción a superadministrador es manual y explícita con `PROMOTE_SUPERADMIN_EMAIL` y `CONFIRM_PROMOTE_SUPERADMIN=true`, y no modifica la contraseña. Las migraciones 005-008 no se aplican a Neon sin autorización explícita (`ALLOW_PRODUCTION_MIGRATION=true`). Las credenciales de prueba se toman de variables `TEST_*`/`E2E_*` sobre una fixture local; no hay credenciales demo en login, tests ni documentación.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm install` | Instala backend y frontend desde la raíz (workspaces). |
| `npm run dev` | Configura, aplica migraciones pendientes en BD local, inicia API + Vite y abre el navegador. |
| `npm run build` | Compila la SPA; en Vercel aplica antes las migraciones pendientes solo si están autorizadas. |
| `npm test` | Pruebas automáticas. Sin `DATABASE_URL` omite las integraciones y ejecuta las pruebas puras; con BD usa credenciales `TEST_*` de una fixture local. |
| `npm run test:integration` | Solo pruebas con base de datos (requiere `DATABASE_URL` y credenciales `TEST_*`). |
| `npm run test:permissions` | Pruebas unitarias de la matriz de permisos del frontend. |
| `npm run test:superadmin-e2e` | Regresión E2E opcional del login de superadministrador (requiere `E2E_BASE_URL`, `E2E_SUPERADMIN_EMAIL` y `E2E_SUPERADMIN_PASSWORD`; no usa localhost por defecto). |
| `npm run lint` | ESLint de backend y frontend. |
| `npm run migrate` / `migrate:status` | Aplicar/consultar migraciones de forma manual. Aplicar en una BD no local exige autorización explícita. |
| `npm run admin` | Crear o actualizar el usuario inicial de un establecimiento. |
| `npm run promote:superadmin` | Promueve manualmente una cuenta existente a superadministrador (requiere correo y confirmación). |
| `npm run seed` | Deshabilitado: no carga datos demo; el SQL antiguo queda como referencia histórica. |
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
| `SEED_ADMIN_*` | No | Datos para `npm run admin`, incluido `SEED_ADMIN_ESTABLISHMENT_ID`. |
| `PROMOTE_SUPERADMIN_EMAIL`, `CONFIRM_PROMOTE_SUPERADMIN` | No | Promoción manual a superadministrador; requieren el correo y `true` para confirmar. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_TIMEOUT_MS`, `OPENROUTER_MAX_TOKENS` | No | Copiloto IA: solo backend; modelo gratuito `openrouter/free`. Sin clave, IA no disponible. |
| `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_CONSULTA_EMAIL`, `TEST_CONSULTA_PASSWORD`, `TEST_ADMIN_ESTABLISHMENT_ID` | No | Credenciales de la fixture local para pruebas de integración. |
| `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_HOME_PATH` | No | Credenciales y ruta inicial esperada para pruebas E2E locales. |
| `ALLOW_NONLOCAL_TESTS` | No | Habilita pruebas contra una BD no local; por defecto desactivado. |
| `ALLOW_PRODUCTION_MIGRATION` | No | Autorización explícita para aplicar migraciones a una BD no local. |

No existe `VITE_API_URL`: el frontend usa `/api` de forma relativa.

## Funcionalidad preservada

- Autenticación JWT con revocación por `jti`, cuatro roles y permisos verificados siempre en backend; el `establishment_id` sale del token validado.
- Login profesional: sin cartel demo ni registro público. `/auth/me` hidrata permisos para todos los roles y la ruta inicial es `/superadmin` para superadministrador, `/movimientos` para encargado de inventario y `/` para los demás; con `must_change_password` se abre `/perfil`.
- Contraseñas bcrypt, cambio obligatorio en el primer login, `password_version`, revocación de sesiones y bloqueo de usuarios inactivos y de establecimientos desactivados. Nunca se muestran hashes.
- Aislamiento multiempresa en SQL (RLS/FORCE RLS y predicados explícitos en repositorios), con `fn_app_is_system()` como único bypass.
- Productos, categorías, proveedores, movimientos IN/OUT, historial, alertas, indicadores, dashboard, gráficas, usuarios y perfil.
- Los 10 reportes JSON/CSV/PDF se generan en servidor, sin escribir archivos en disco, y están aislados por establecimiento.
- Fuente única de verdad SQL: `v_product_inventory` y `fn_register_movement()` con `SELECT ... FOR UPDATE`.
- Diseño responsive y validación de formularios con Zod.

## Asistente IA

El módulo **Asistente IA** (`/ia`) calcula en backend, con los movimientos del establecimiento:

- Demanda diaria estimada mediante suavizado exponencial con tendencia atenuada.
- Stock de seguridad y punto de pedido para un lead time configurable (7/14/21/30 días).
- Días de cobertura, nivel de riesgo y priorización de acciones.
- Detección de picos atípicos (anomalías) y una narrativa resumida.
- Confianza de la estimación según la cantidad de días con historial.

Ese cálculo es **local, determinista y explicable**; las alertas oficiales de stock mínimo siguen calculándose en `v_product_inventory`. El **copiloto conversacional**, en cambio, no genera respuestas por reglas locales: usa exclusivamente OpenRouter en su modalidad gratuita (`openrouter/free`, `usage.cost === 0`), con autenticación, consentimiento y rate limit. El backend construye un contexto agregado del establecimiento y lo envía a OpenRouter **solo después de que el usuario autorice el envío**: el copiloto sí comparte información agregada con un tercero cuando hay consentimiento. Sin clave configurada o sin consentimiento muestra un aviso de servicio no disponible; no hay fallback local ni de pago.

## Migraciones

`npm run dev` y el build del servicio `backend` en Vercel ejecutan `node backend/src/scripts/migrate.js up` una sola vez por arranque/despliegue. El ejecutor:

- Registra versiones en `schema_migrations` y aplica únicamente archivos pendientes.
- Usa una transacción por migración y un bloqueo advisory para despliegues concurrentes.
- Usa la URL directa de Neon para DDL; nunca se ejecuta por petición HTTP.
- No elimina datos ni carga demo (el seed está deshabilitado).
- Rechaza migrar una base no local salvo `ALLOW_PRODUCTION_MIGRATION=true`; `migrate:status` es solo lectura.

Las migraciones de la arquitectura multiempresa son `005_multi_tenant.sql`, `006_tenant_foreign_keys.sql`, `007_tenant_defaults.sql` y `008_harden_tenant_boundaries.sql`. **No aplicarlas a Neon sin autorización explícita.** Los registros comerciales existentes se asociaron al establecimiento Principal (`id=1`) y los usuarios existentes quedaron con `establishment_id` NULL hasta asignación o promoción explícita. El SQL de `database/seeds/` se conserva solo como referencia histórica y no se ejecuta.

## Despliegue en Vercel Services

1. Suba este repositorio a GitHub (sin `.env`; está ignorado).
2. En Vercel: **Add New → Project** e importe ese repositorio. Vercel detecta dos servicios; conserve los nombres `backend` y `frontend` y sus raíces `backend/` y `frontend/`.
3. Configure las variables de entorno del proyecto: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN=https://su-dominio.vercel.app` y `NODE_ENV=production`. `OPENROUTER_*` va solo en el servicio `backend`. No active `ALLOW_PRODUCTION_MIGRATION` salvo autorización explícita para las migraciones 005-008.
4. Despliegue. Cada servicio instala y compila sus dependencias de forma independiente:
   - `backend` exporta Express desde `backend/api/index.js` (sin `app.listen()`) y su build ejecuta las migraciones pendientes una sola vez por despliegue, sujetas a la autorización anterior.
   - `frontend` compila la SPA en `frontend/dist` y sirve el fallback de React Router.
5. Cree el usuario inicial apuntando a la misma BD de Neon con `npm run admin` desde una máquina que tenga el `.env` correspondiente. Si debe haber superadministrador, promuévalo de forma manual con `npm run promote:superadmin` y las variables de confirmación.

`vercel.json` enruta `/api` y `/api/*` al servicio `backend` (sin quitar el prefijo), `/health` también al backend y el resto al servicio `frontend`. Recargar `/productos`, `/ia`, `/superadmin`, etc. funciona gracias al fallback definido dentro del servicio frontend. No se añadieron service bindings: el navegador llama a `/api` en el mismo dominio.

Las migraciones `005`–`008` ya se aplicaron a Neon con autorización explícita y `admin@su-dominio.com` fue promovido a `SUPERADMINISTRADOR` sin cambiar su contraseña; no se ha realizado un despliegue real desde este entorno. El 2026-11-23 se corrigió el acceso del superadministrador: el login siempre aterriza en `/superadmin`, las rutas de inventario lo devuelven a su panel, el layout no pide alertas sin permiso y `/auth/me` respalda los permisos por rol si el backend desplegado es antiguo. La regresión unitaria quedó versionada en `frontend/tests/permissions.test.mjs`. También se crearon tres usuarios operativos en el establecimiento 1 (`ADMINISTRADOR`, `ENCARGADO_INVENTARIO` y `CONSULTA`) con la misma contraseña, verificados con login directo contra Neon. Esta ronda se validó **sin pruebas en localhost**: `lint` sin errores, `test:permissions` 4/4, `test:fields` 6/6, `test:unit` 44/44 sin conexión a base (URL local ficticia solo para el guard de pruebas puras) y `build` correcto de 2109 módulos.

## Estructura

```text
backend/                  API REST, servicios, repositorios, scripts
backend/api/index.js      entrada Express del servicio backend en Vercel
backend/src/config/tenant.js  predicado SQL de aislamiento por establecimiento
database/migrations/      DDL versionado (fuente de verdad, incluye 005-008)
database/seeds/           SQL demo histórico, no ejecutable
frontend/                 SPA React + Vite (servicio frontend, con panel /superadmin)
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
