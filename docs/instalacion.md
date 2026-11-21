# Instalación y despliegue

## Requisitos

- Node.js 20+ y npm.
- Proyecto y base de datos creados en Neon.
- No se requiere Docker, PostgreSQL local ni `psql`.

## 1. Configuración única

Copie la plantilla y edite **solo** el `.env` de la raíz:

```bash
cp .env.example .env
```

Valores mínimos:

```env
DATABASE_URL=postgresql://USUARIO:CONTRASENA@ep-xxxx-pooler.REGION.aws.neon.tech/stockalert?sslmode=require
DIRECT_URL=
JWT_SECRET=cambiar_por_una_cadena_larga_y_aleatoria_de_al_menos_32_caracteres
CORS_ORIGIN=http://localhost:5173
```

- `DATABASE_URL`: copiar desde Neon → *Connection Details* → **Pooled connection**.
- `DIRECT_URL`: opcional; si se deja vacía se deriva quitando `-pooler` del host. Se usa solo para migraciones/DDL.
- TLS se fuerza automáticamente para `*.neon.tech` con verificación de certificado.
- No cree `backend/.env` ni `frontend/.env`; el backend lee el `.env` raíz y el frontend usa siempre `/api`.

## 2. Instalar y arrancar

```bash
npm install
npm run dev
```

`npm run dev`:

1. Verifica que exista `.env` y que `DATABASE_URL` y `JWT_SECRET` sean válidos.
2. Conecta a la BD configurada y aplica solo las migraciones pendientes; en una BD no local exige autorización explícita.
3. Inicia la API Express (`http://localhost:4000`, configurable con `PORT`).
4. Inicia Vite en `http://localhost:5173` y proxifica `/api` y `/health` hacia la API.
5. Abre el navegador y muestra errores comprensibles si algo falla.

Para crear el usuario inicial real, asignado a un establecimiento:

```env
SEED_ADMIN_NAME=Administrador Principal
SEED_ADMIN_EMAIL=admin@su-dominio.com
SEED_ADMIN_PASSWORD=<contraseña_inicial>
SEED_ADMIN_ESTABLISHMENT_ID=1
```

```bash
npm run admin
```

`npm run seed` está **deshabilitado**: no carga datos de demostración, usuarios ni credenciales. El SQL en `database/seeds/` se conserva solo como referencia histórica y no debe ejecutarse en bases multiempresa. Nunca se ejecuta desde `npm run dev` ni desde el build de ningún servicio.

## 3. Migraciones multiempresa y promoción segura

Las migraciones de la arquitectura multiempresa son `005_multi_tenant.sql`, `006_tenant_foreign_keys.sql`, `007_tenant_defaults.sql` y `008_harden_tenant_boundaries.sql`.

1. Consulte primero el estado, que es solo lectura: `npm run migrate:status`.
2. En una BD local o fixture, aplique las pendientes con `npm run migrate`.
3. **No aplique 005-008 a Neon sin autorización explícita del propietario.** El ejecutor bloquea una BD no local salvo `ALLOW_PRODUCTION_MIGRATION=true`; no active esa variable por defecto.
4. Los registros comerciales existentes se asociaron al establecimiento Principal (`id=1`); los usuarios existentes quedaron con `establishment_id` NULL hasta asignación o promoción explícita. No se borraron ni reasignaron datos por suposición.
5. Tras aplicar las migraciones, promueva manualmente al superadministrador (no modifica la contraseña):

```bash
PROMOTE_SUPERADMIN_EMAIL=<correo> CONFIRM_PROMOTE_SUPERADMIN=true npm run promote:superadmin
```

En PowerShell use `$env:PROMOTE_SUPERADMIN_EMAIL='<correo>'` y `$env:CONFIRM_PROMOTE_SUPERADMIN='true'` antes del comando. El superadministrador gestiona establecimientos y cuentas desde `/superadmin`, pero no tiene acceso a inventario ni a IA.

## 4. Verificación local

```bash
npm run lint
npm test
npm run build
```

Sin `DATABASE_URL`, `npm test` ejecuta solo pruebas puras y omite las integraciones. Para la suite completa use una fixture local: `DATABASE_URL` y las credenciales de prueba se toman de `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_CONSULTA_EMAIL`, `TEST_CONSULTA_PASSWORD` y `TEST_ADMIN_ESTABLISHMENT_ID` (E2E: `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_HOME_PATH`). No apunte las pruebas a una BD de producción salvo autorización explícita con `ALLOW_NONLOCAL_TESTS=true`.

`npm run build` compila únicamente la SPA. Las migraciones se ejecutan con `npm run migrate`, desde `npm run dev` o desde el build del servicio backend en Vercel, siempre sujetas a la autorización indicada arriba.

## 5. Despliegue en Vercel Services

Un repositorio, un proyecto, dos servicios (`backend` y `frontend`) en el mismo dominio:

1. Suba el repositorio sin el `.env` (ignorado por Git).
2. Vercel → *Add New* → *Project* → importe el repositorio. Conserve los nombres y raíces detectados: `backend` → `backend/`, `frontend` → `frontend/`.
3. En *Environment Variables* del proyecto configure al menos:
   - `DATABASE_URL` (pooler de Neon)
   - `DIRECT_URL` (recomendado; si no, se deriva)
   - `JWT_SECRET`
   - `CORS_ORIGIN=https://su-dominio.vercel.app`
   - `NODE_ENV=production`
   - `OPENROUTER_API_KEY` y el resto de `OPENROUTER_*` solo en el servicio `backend`
   - No active `ALLOW_PRODUCTION_MIGRATION` sin autorización explícita para aplicar 005-008 en Neon.
4. Despliegue. No cree un backend externo ni un segundo proyecto.

Qué hace cada servicio:

- Ambos ejecutan `npm install` desde su raíz; npm detecta el workspace raíz del repositorio, por lo que las dependencias se resuelven como en local.
- `backend`: su build (`npm run build` del workspace backend) ejecuta las migraciones pendientes una vez por despliegue. Las migraciones 005-008 ya se aplicaron a Neon con autorización explícita, por lo que un despliegue posterior no las repetirá. El entrypoint es `backend/api/index.js`, que exporta la app Express sin `app.listen()`; `server.js` solo se usa en local.
- `frontend`: su build compila la SPA en `frontend/dist`. El fallback a `/index.html` está declarado dentro del servicio frontend, así que las recargas de React Router funcionan.
- `vercel.json` enruta `/api` y `/api/*` al servicio `backend` sin quitar el prefijo, y `/health` también al backend. El resto va al frontend.
- La SPA usa `/api`, así que no hay URLs absolutas ni secretos en el bundle. No se configuraron service bindings porque el navegador llama al mismo dominio.

Después del primer despliegue, cree el usuario inicial con `npm run admin` usando un `.env` local que apunte a la misma base de datos de Neon. Si corresponde, promueva al superadministrador con `npm run promote:superadmin` y las variables de confirmación; no hay credenciales demo.

## 6. Artefacto de un solo puerto

Para verificar localmente el mismo modo de entrega sin Vercel:

```bash
npm run build
npm start
```

La API sirve además `frontend/dist` y el fallback de la SPA. En Vercel este comportamiento se desactiva con `VERCEL=1` porque la plataforma sirve los archivos estáticos.

## Solución de problemas

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| “No existe el archivo .env” | Falta la configuración | Copiar `.env.example` como `.env`. |
| “Configuración incompleta” | Falta `DATABASE_URL` o `JWT_SECRET` corto | Revisar el `.env` de la raíz. |
| `/health` responde 503 | No se puede conectar a Neon | Verificar la URL pooler, el usuario y que la BD esté activa. |
| Error de TLS | Cadena sin soporte SSL | Usar la URL de Neon con `sslmode=require`; no desactivar la verificación. |
| Error al migrar | `DIRECT_URL` inválida o permisos insuficientes | Usar la URL directa de Neon para DDL. |
| Migraciones rechazadas en Neon | Falta autorización explícita para BD no local | Revisar con `npm run migrate:status`; no aplicar 005-008 sin `ALLOW_PRODUCTION_MIGRATION=true` autorizado. |
| `npm run seed` no carga nada | Seed deshabilitado en la arquitectura multiempresa | Crear establecimientos y cuentas desde `/superadmin` o con `npm run admin`; no existen credenciales demo. |
| No puedo entrar a `/superadmin` | La cuenta no fue promovida | Promover de forma manual con `PROMOTE_SUPERADMIN_EMAIL` y `CONFIRM_PROMOTE_SUPERADMIN=true`. |
| `ECONNREFUSED` en el navegador | API caída | Revisar la terminal de `npm run dev` y el puerto `PORT`. |
