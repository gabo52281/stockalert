# Seguridad

## 1. Autenticación

- `POST /api/auth/login` valida correo y contraseña con Zod y bcryptjs (hash con factor 12).
- El token JWT incluye `sub` (usuario), `role`, `jti` y expiración (`JWT_EXPIRES_IN`, por defecto 8 h).
- El middleware `authenticate` verifica firma y expiración, consulta el usuario activo y comprueba que su `jti` no esté en `revoked_tokens`.
- `POST /api/auth/logout` inserta el `jti` en `revoked_tokens`; el token deja de ser válido inmediatamente.
- La SPA guarda el token en `localStorage` y lo envía como `Authorization: Bearer …`. Al recibir un 401, limpia el token y dispara redirección al login.

## 2. Autorización

La matriz de `backend/src/config/permissions.js` se aplica **en el backend** mediante `authorize(permiso)` y `authorize.requireRole(rol)`. El frontend usa la misma información para ocultar controles, pero eso no es la barrera de seguridad.

| Rol | Alcance |
| --- | --- |
| `ADMINISTRADOR` | acceso total (`*`) |
| `ENCARGADO_INVENTARIO` | catálogos y movimientos, alertas, indicadores, dashboard, reportes, perfil |
| `CONSULTA` | solo lectura y exportación, perfil propio |

Rutas protegidas en la SPA: si el usuario no tiene el permiso de la ruta, se redirige a `/acceso-denegado`.

## 3. Validación y consultas

- Todas las entradas (body, query y params) se validan con esquemas Zod antes de llegar al controlador.
- Todas las consultas usan placeholders `$1, $2…`; no hay concatenación de datos del usuario en SQL.
- Los nombres de columna usados en `ORDER BY` se mapean desde una lista fija (`SORT_MAP`), nunca desde texto libre.
- `fn_register_movement()` bloquea la fila del producto y valida stock dentro de una transacción: impide stock negativo y carreras entre operaciones concurrentes.
- No hay endpoints para editar o eliminar movimientos: se preserva la trazabilidad histórica.

## 4. Protecciones HTTP

- **Helmet** con cabeceras de seguridad; `x-powered-by` desactivado.
- **CORS** restringido a los orígenes de `CORS_ORIGIN`.
- **Rate limiting**: límite general configurable y límite específico para login (20 intentos fallidos por 15 minutos; las peticiones exitosas no cuentan).
- **Compresión** y límite de 1 MB en el cuerpo JSON.
- **Morgan** para logs HTTP (`requestLogger`, desactivado en pruebas); el middleware `audit` escribe cada movimiento de inventario en `audit_log` con usuario, IP y detalles.
- **Manejo centralizado de errores**: traduce errores PostgreSQL a códigos de API y no expone stack traces cuando `NODE_ENV=production`.

## 5. Secretos

- Existe **un único** `.env` en la raíz, ignorado por Git; solo se versiona `.env.example`. No hay `backend/.env` ni `frontend/.env`.
- El backend carga ese archivo; en Vercel las variables se inyectan por entorno y no existe archivo físico.
- El frontend usa `/api` de forma relativa: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` y demás secretos **nunca** entran al bundle de Vite. No hay `VITE_API_URL`.
- `JWT_SECRET` es obligatorio en tiempo de ejecución y debe tener al menos 32 caracteres aleatorios.
- `DATABASE_URL` es obligatoria: se usa la URL **pooler** de Neon. Las migraciones usan `DIRECT_URL` o la derivación automática sin `-pooler`.
- TLS se fuerza para `*.neon.tech` con verificación de certificado (`rejectUnauthorized: true`). No se desactiva la validación.
- El seed solo guarda hashes bcrypt; la contraseña demo se define en `DEMO_PASSWORD` y la carga demo se bloquea cuando `NODE_ENV=production`.
- El primer administrador real se crea con `npm run admin` usando `SEED_ADMIN_*`; las credenciales no se escriben en el código.
- El asistente IA se ejecuta en backend con datos ya autorizados; no envía información a servicios externos.

## 6. Checklist para producción

1. `NODE_ENV=production`, `JWT_SECRET` fuerte y `CORS_ORIGIN` con el dominio real.
2. `DATABASE_URL` pooler de Neon con `sslmode=require`; `DIRECT_URL` opcional para DDL.
3. No ejecutar `npm run seed`.
4. Crear el administrador con `npm run admin` y cambiar contraseñas iniciales.
5. Verificar `/health`, login, roles, `/api/ia/insights` y exportaciones antes de abrir el acceso.
6. Confirmar que el bundle de frontend no contiene secretos y que las rutas `/api` responden en el mismo dominio.
7. En Vercel, mantener las variables solo en la configuración del proyecto; nunca en el repositorio.

## 7. Exclusiones de seguridad

El sistema no implementa recuperación de contraseña por correo, doble factor, SSO ni auditoría inmutable criptográfica. Esa funcionalidad queda fuera del alcance académico del proyecto.
