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
| `SUPERADMINISTRADOR` | establecimientos, cuentas y estadísticas globales desde `/superadmin`; **sin acceso a inventario ni a IA** |
| `ADMINISTRADOR` | inventario completo dentro de su establecimiento; **no gestiona cuentas** |
| `ENCARGADO_INVENTARIO` | inventario completo dentro de su establecimiento; **no gestiona cuentas** |
| `CONSULTA` | solo lectura y exportación dentro de su establecimiento, perfil propio |

El `establishment_id` se toma del JWT validado en `authenticate()`; cualquier `tenant_id` enviado por el frontend se ignora. Un token de superadministrador no tiene contexto de establecimiento y, por diseño, no puede consultar inventario.

Rutas protegidas en la SPA: si el usuario no tiene el permiso de la ruta, se redirige a `/acceso-denegado`. Tras el login, `/auth/me` hidrata los permisos de todos los roles y `homePathFor` envía al superadministrador a `/superadmin`, al encargado de inventario a `/movimientos` y, si `mustChangePassword` está activo, a `/perfil`.

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
- **No existe `DEMO_PASSWORD` ni carga demo:** `npm run seed` está deshabilitado y no crea usuarios ni contraseñas. El SQL en `database/seeds/` se conserva solo como referencia histórica y no debe ejecutarse en bases multiempresa.
- El usuario inicial se crea con `npm run admin` usando `SEED_ADMIN_*` (incluido `SEED_ADMIN_ESTABLISHMENT_ID`); las credenciales no se escriben en el código y las contraseñas se guardan como hashes bcrypt.
- La promoción a superadministrador es manual: `PROMOTE_SUPERADMIN_EMAIL` y `CONFIRM_PROMOTE_SUPERADMIN=true` con `npm run promote:superadmin`. No modifica contraseñas ni imprime secretos.
- El cálculo del Asistente IA se ejecuta en backend con datos ya autorizados. El chat **envía información a un tercero**: un resumen agregado del establecimiento a OpenAI, con autenticación y rate limit, usando el modelo de `OPENAI_MODEL`. No hay consentimiento previo; sin clave o ante error muestra servicio no disponible, sin respuesta local de respaldo. Las variables `OPENAI_API_KEY` y `OPENAI_MODEL` viven solo en backend/Vercel.

## 6. Aislamiento multiempresa

- `establishment_id` derivado del JWT validado en backend; `tenant_id` del frontend se ignora.
- RLS/FORCE RLS en tablas de inventario alimentado por los GUCs `app.current_establishment_id` y `app.current_role`.
- Predicados SQL explícitos en los repositorios porque el rol de conexión puede ser dueño de las tablas y omitir RLS.
- `fn_app_is_system()` es el único bypass, reservado a mantenimiento; el superadministrador no puede leer inventario de ninguna empresa.
- bcrypt, `must_change_password` en primer login, `password_version`, revocación de sesiones por `jti`, bloqueo de usuarios inactivos y de establecimientos desactivados. Los hashes nunca se muestran.

## 7. Checklist para producción

1. `NODE_ENV=production`, `JWT_SECRET` fuerte y `CORS_ORIGIN` con el dominio real.
2. `DATABASE_URL` pooler de Neon con `sslmode=require`; `DIRECT_URL` opcional para DDL.
3. `npm run seed` está deshabilitado: no hay datos ni credenciales demo que cargar.
4. Crear el usuario inicial con `npm run admin` y cambiar contraseñas iniciales; promover al superadministrador solo de forma manual y autorizada.
5. Las migraciones 005-008 ya están aplicadas a Neon con autorización explícita; no ejecutarlas de nuevo sin `ALLOW_PRODUCTION_MIGRATION=true` y una nueva autorización.
6. Verificar `/health`, login por rol, `/superadmin`, `/api/ia/status`, una pregunta del chat y exportaciones aisladas antes de abrir el acceso.
7. Confirmar que el bundle de frontend no contiene secretos y que las rutas `/api` responden en el mismo dominio.
8. En Vercel, mantener las variables solo en la configuración del proyecto; nunca en el repositorio.

## 8. Exclusiones de seguridad

El sistema no implementa recuperación de contraseña por correo, doble factor, SSO ni auditoría inmutable criptográfica. Esa funcionalidad queda fuera del alcance académico del proyecto.
