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
2. Conecta a Neon y aplica solo las migraciones pendientes.
3. Inicia la API Express (`http://localhost:4000`, configurable con `PORT`).
4. Inicia Vite en `http://localhost:5173` y proxifica `/api` y `/health` hacia la API.
5. Abre el navegador y muestra errores comprensibles si algo falla.

Para crear el primer administrador real:

```env
SEED_ADMIN_NAME=Administrador Principal
SEED_ADMIN_EMAIL=admin@su-dominio.com
SEED_ADMIN_PASSWORD=Cambiar1234!
```

```bash
npm run admin
```

Para cargar datos de demostración **solo en desarrollo**:

```bash
npm run seed
```

`seed` se bloquea automáticamente cuando `NODE_ENV=production`; nunca se ejecuta desde `npm run dev` ni desde el build de Vercel.

## 3. Verificación local

```bash
npm run lint
npm test
npm run build
```

Sin `DATABASE_URL`, `npm test` ejecuta solo pruebas puras y omite las integraciones. Para ejecutar la suite completa contra su BD de Neon, configure `DATABASE_URL` en el `.env` y vuelva a correr `npm test`.

## 4. Despliegue en Vercel

Un repositorio, un proyecto:

1. Suba el repositorio sin el `.env` (ignorado por Git).
2. Vercel → *Add New* → *Project* → importe el repositorio.
3. En *Environment Variables* configure al menos:
   - `DATABASE_URL` (pooler de Neon)
   - `DIRECT_URL` (recomendado; si no, se deriva)
   - `JWT_SECRET`
   - `CORS_ORIGIN=https://su-dominio.vercel.app`
   - `NODE_ENV=production`
4. Despliegue. No configure un servicio externo de backend.

Qué hace Vercel con este repositorio:

- `npm install` instala los workspaces `backend` y `frontend`.
- `npm run build`: como `VERCEL=1`, ejecuta las migraciones pendientes una vez y luego compila la SPA en `frontend/dist`.
- `/api/(.*)` se reescribe a `api/index.js`, que exporta la app Express; `server.js` (con `listen`) no se importa.
- El resto de rutas se reescriben a `/index.html`, por lo que las recargas de React Router funcionan.
- La SPA usa `/api`, así que no hay URLs absolutas ni secretos en el bundle.

Después del primer despliegue, cree el administrador con `npm run admin` usando un `.env` local que apunte a la misma base de datos de Neon.

## 5. Artefacto de un solo puerto

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
| `ECONNREFUSED` en el navegador | API caída | Revisar la terminal de `npm run dev` y el puerto `PORT`. |
