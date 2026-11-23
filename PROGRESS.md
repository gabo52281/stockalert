# PROGRESS — STOCKALERT

Registro de avance y estado final del proyecto tras la refactorización a Neon + Vercel y la adopción de la arquitectura multiempresa.

## Estado actual

STOCKALERT funciona con **una sola base de datos Neon**, **un único `.env` en la raíz**, **un solo comando de desarrollo** (`npm run dev`) y **un proyecto de Vercel**. La arquitectura multiempresa ya está implementada: un **SUPERADMINISTRADOR global** con panel `/superadmin` administra establecimientos y cuentas; cada establecimiento tiene su propio inventario aislado y sus usuarios asignados. El superadministrador **no tiene acceso a inventario ni IA**.

- Roles: `SUPERADMINISTRADOR` (`establishments:*`, `users:*`, `admin-stats:read`, `profile:*`), `ADMINISTRADOR` y `ENCARGADO_INVENTARIO` (inventario completo en su tenant) y `CONSULTA` (solo lectura en su tenant).
- Última verificación de esta ronda (2026-11-23), **sin pruebas en localhost**: `npm run lint` sin errores, `npm run test:permissions` 4/4, `npm run test:fields` 6/6, `npm run test:unit` 44/44 con una URL local ficticia solo para pasar el guard de pruebas puras (sin servidor ni conexión) y `npm run build` correcto con 2109 módulos. El historial de pruebas con fixture local se conserva más abajo como referencia, no se repitió.
- Corregido el acceso del superadministrador: `LoginPage` navega siempre a `homePathFor`, `ProtectedRoute` lo devuelve a `/superadmin` desde rutas sin permiso, `AppLayout` no solicita `/api/alerts/summary` sin `alerts:read`, y `/auth/me` más el frontend respaldan los permisos por rol cuando el backend desplegado es antiguo. Regresión unitaria versionada en `frontend/tests/permissions.test.mjs` (`npm run test:permissions`).
- Creados tres usuarios operativos en el establecimiento 1 (`ADMINISTRADOR`, `ENCARGADO_INVENTARIO` y `CONSULTA`) con la misma contraseña; se verificó el login directamente contra Neon, sin servidor local. Las credenciales se entregaron al propietario fuera del repositorio.
- El contexto de tenant se toma del JWT (`pv`/`est`) y se valida contra la base de datos: usuario real, `password_version`, establecimiento activo y token no revocado. Se propaga con `AsyncLocalStorage` y GUCs por transacción; RLS/FORCE RLS, predicados SQL explícitos y `fn_app_is_system()` como único bypass. El `tenant_id` del frontend se ignora.
- Migraciones `005`–`008` incluidas en el repositorio y **aplicadas a Neon con autorización explícita**; `admin@su-dominio.com` promovido a `SUPERADMINISTRADOR` sin cambiar contraseña. Despliegue aún pendiente.
- Insights deterministas: cálculo local de indicadores. Chat conversacional: **OpenAI** (`OPENAI_MODEL=gpt-5.6-luna`), con prompt profesional, contexto agregado por establecimiento y sin consentimiento ni respuestas locales de respaldo.
- Seed demo deshabilitado: no hay credenciales demo en documentación ni tests. Las pruebas usan `TEST_*`/`E2E_*` del entorno contra un fixture local desechable.
- Despliegue real en Vercel: **autorizado pero no ejecutado desde este entorno**. Neon ya está migrado y con el superadministrador promovido. La clave `OPENAI_API_KEY` debe configurarse solo en el servicio backend (nunca como `VITE_*`); la antigua clave de OpenRouter quedó fuera de `.env` y debe considerarse retirada.

## FASE 1 — Análisis y planificación

**Estado:** COMPLETADA

- Monorepo con `backend/`, `frontend/`, `database/` y `docs/`.
- JWT con revocación por `jti`, cuatro roles y permisos verificados en backend.
- Alertas calculadas en SQL y concurrencia resuelta con `SELECT ... FOR UPDATE`.
- Primer administrador creado por script con variables de entorno.

## FASE 2 — Base de datos

**Estado:** COMPLETADA

- `001_init.sql`, `002_config.sql`, `003_fix_movement_type_length.sql` y `004_inventory_view.sql` conservados sin cambios.
- Migraciones `005_multi_tenant.sql`, `006_tenant_foreign_keys.sql`, `007_tenant_defaults.sql` y `008_harden_tenant_boundaries.sql` añadidas: tenant, unicidad por establecimiento, FK compuestas, defaults desde GUC, RLS endurecido y movimientos validados.
- `fn_register_movement()` como única vía de entradas/salidas, ahora con validación de tenant de `user_id` y `supplier_id`.
- `v_product_inventory` como fuente única de verdad de alertas, cobertura y valoración, filtrada por establecimiento.
- El seed demostrativo quedó deshabilitado: `database/seeds/001_demo.sql` solo se conserva como referencia histórica.

## FASE 3 — Backend

**Estado:** COMPLETADA

- Express + Helmet + CORS + compresión + rate limiting + logger.
- Zod, manejo centralizado de errores, repositorios, servicios y controladores.
- Módulos: auth, users, **establishments**, categories, suppliers, products, movements, alerts, indicators, dashboard, reports e **ia**.
- Contexto de tenant con `AsyncLocalStorage`, GUCs por transacción y `tenantPredicate` en los repositorios; `fn_app_is_system()` queda reservado a tareas internas.
- CSV con BOM y PDF generados en memoria, sin escribir en disco.

## FASE 4 — Frontend React

**Estado:** COMPLETADA

- SPA con React Router, Axios relativo a `/api`, contexto de autenticación y notificaciones.
- Páginas de panel, productos, movimientos, alertas, indicadores, reportes, catálogos, usuarios y perfil.
- Nueva página **Administración general** (`/superadmin`) para establecimientos y cuentas, con acceso restringido por permiso.
- Diseño responsive y gráficas con Recharts.

## FASE 5 — Pruebas y verificación

**Estado:** COMPLETADA

- Backend: Vitest + Supertest. Última ronda: 8 archivos, 99/99 pruebas superadas contra fixture local.
- Las pruebas de integración solo escriben en una base local/desechable; las credenciales se leen de variables `TEST_*` y `E2E_*`.
- Verificación local de lint y build sin errores; migraciones 005–008 aplicadas a Neon tras validación con rollback; despliegue pendiente.

## FASE 6 — Documentación

**Estado:** COMPLETADA

- README, instalación, arquitectura, base de datos, API, seguridad, alcance, manual de usuario y resultados reales de pruebas actualizados.
- Eliminadas las referencias a PostgreSQL local, Docker, imágenes/compose y entornos múltiples como dependencia del proyecto.
- Documentadas la arquitectura multiempresa, las migraciones 005–008, el contexto de tenant y los permisos del superadministrador.
- Documentado el modelo IA local para insights y el chat con OpenAI (antes OpenRouter; ver FASE 13).

## FASE 7 — Refactorización a Neon y Vercel

**Estado:** COMPLETADA

- Eliminados `embedded-postgres`, `embeddedDb.js`, Dockerfiles, compose, `.dockerignore` y plantillas de entorno duplicadas.
- Único `.env` raíz cargado por backend, scripts de migración y orquestadores.
- Pool de API pequeño (`max: 5`), TLS verificado para `*.neon.tech` y URL directa derivada de `-pooler`.
- `migrate.js` usa URL directa, transacción por archivo y `pg_advisory_lock` para despliegues concurrentes.
- `backend/api/index.js` exporta la app Express sin `listen()`; es el entrypoint del servicio `backend` en Vercel Services.
- `vercel.json` usa el formato `services` con `backend` y `frontend`: enruta `/api` y `/api/*` al backend conservando el prefijo, `/health` al backend y el resto al frontend con fallback de React Router dentro de ese servicio.
- `npm run dev`: valida configuración, migra, levanta API y Vite, espera `/health`, abre el navegador y muestra errores comprensibles.
- Cada servicio instala y compila por separado. El build del servicio backend usa `migrate.js build`: en producción aplica migraciones solo con autorización explícita y, si no la hay, las omite sin fallar; el build del frontend solo compila la SPA.

## FASE 8 — Asistente IA local

**Estado:** COMPLETADA

- `GET /api/ia/insights?days=30&leadTimeDays=14&limit=8` con autenticación y permiso `indicators:read`.
- Serie diaria a partir de movimientos OUT reales; suavizado exponencial con tendencia atenuada.
- Stock de seguridad, punto de pedido, días de cobertura, riesgo, prioridad y narrativa resumida.
- Detección de picos atípicos mediante desviación estándar.
- Los insights son locales y deterministas: sin proveedores externos en este endpoint, sin `API_KEY` y sin envío de datos.
- Interfaz `/ia` integrada en menú, topbar y ruta protegida.

## FASE 9 — Reportes PDF y copiloto conversacional

**Estado:** COMPLETADA

- Rediseño de los 10 reportes: encabezado azul oscuro con STOCKALERT, título y fecha/hora en `es-CO`, filtros legibles, tabla con anchos fijos, encabezados repetidos, altura de fila adaptable, filas alternadas suaves, cifras a la derecha, texto a la izquierda y pie `Página X de Y` calculado en dos pasadas.
- A4 horizontal automático cuando hay 8+ columnas o 3+ columnas monetarias; resúmenes útiles por reporte; mismo formato COP/entero en PDF, CSV y vista previa.
- `AiInsightsPage.jsx` convertida en copiloto: resumen, recomendaciones, chat con historial, indicador de progreso, tablas pequeñas, preguntas rápidas y nueva conversación. El consentimiento original fue eliminado en FASE 13.
- Backend IA (histórico): `ai-chat.service.js` con intents, presupuesto determinista y validación de modelo gratuito de OpenRouter. Esa capa de proveedor fue reemplazada por OpenAI en FASE 13; los intents y el presupuesto determinista se conservan.
- La clave solo existe en backend/Vercel (antes `OPENROUTER_API_KEY`, ahora `OPENAI_API_KEY`); sin clave no se envían datos y el chat informa que el asistente está temporalmente fuera de servicio. No hay variables `VITE_` con secretos ni respuestas locales de respaldo. El contexto es agregado del tenant y nunca contiene SQL ni secretos.

## FASE 10 — Arquitectura multiempresa

**Estado:** COMPLETADA

- `SUPERADMINISTRADOR` global con panel `/superadmin`, establecimientos aislados y usuarios por establecimiento; gestión de cuentas exclusiva del superadmin.
- Endpoints `/api/establishments` (CRUD, `active`, `users`, `stats`, `with-admin`) y `/api/users` (filtros por establecimiento y reset de contraseña), con rutas y permisos confirmados en el código.
- JWT con `pv`/`est`, validación de usuario real, `password_version`, establecimiento activo y revocación; `AsyncLocalStorage` + GUCs por transacción; RLS/FORCE RLS y predicados SQL explícitos por repositorio; `fn_app_is_system()` como único bypass.
- Migraciones 005–008 con base multiempresa, FK compuestas, defaults desde GUC y endurecimiento de RLS: el superadmin sin inventario, validación de tenant en `fn_register_movement()` y FK movimientos-usuario condicionada a datos consistentes.
- `users.email` único global; código de producto, nombre de categoría, NIT de proveedor y `source_key` únicos por establecimiento. Registros comerciales antiguos al establecimiento 1; `users` en `NULL` hasta asignación explícita.
- Seed demo deshabilitado y sin credenciales demo; verificación con fixture local y variables `TEST_*`/`E2E_*`.

## FASE 11 — Regresión del acceso del superadministrador

**Estado:** COMPLETADA

- `LoginPage.jsx` dejó de priorizar `state.from` y siempre navega a `homePathFor(loggedUser)`; el superadministrador entra directamente en `/superadmin`.
- `ProtectedRoute.jsx` devuelve al superadministrador a su panel cuando una URL directa apunta a una ruta sin permiso, en vez de mostrar `/acceso-denegado`.
- `AppLayout.jsx` condiciona `/api/alerts/summary` a `alerts:read`, eliminando el 403 al cargar el panel.
- `/auth/me` y el frontend usan `permissionsFor(role)` como respaldo cuando el backend no envía permisos; el backend sigue siendo la autoridad. La campana de alertas se oculta sin `alerts:read` y `ForbiddenPage` enlaza al home del rol.
- Regresión unitaria versionada en `frontend/tests/permissions.test.mjs` (4/4 OK), expuesta como `npm run test:permissions`. La prueba E2E opcional `npm run test:superadmin-e2e` exige `E2E_BASE_URL` explícito; no se ejecutó en esta ronda porque se suspendieron las pruebas en localhost.

## FASE 12 — Build de Vercel sin migración forzada

**Estado:** COMPLETADA

- El despliegue del commit `aa40498` falló en Vercel porque el build del workspace `backend` ejecutaba `migrate.js up` y ese comando exige `ALLOW_PRODUCTION_MIGRATION=true` contra Neon.
- `backend/package.json` ahora usa `migrate.js build` en su script `build`. Ese comando aplica migraciones solo en local o con autorización explícita; en producción sin autorización imprime el aviso y termina con código 0.
- `npm run dev` y `npm run migrate` conservan su comportamiento estricto. Las migraciones 005–008 siguen aplicadas y no se repiten.

## FASE 13 — Asistente IA con OpenAI

**Estado:** COMPLETADA

- Sustituido OpenRouter por OpenAI en `backend/src/services/ai-chat.service.js`: endpoint `https://api.openai.com/v1/chat/completions`, modelo configurable en `OPENAI_MODEL` (`gpt-5.6-luna` por defecto), `max_completion_tokens`, timeout de 20 s y un único reintento si la respuesta sale vacía.
- Prompt rediseñado como analista senior de operaciones e inventarios: conclusión, cifras clave y acción recomendada, máximo 220 palabras, siempre en español colombiano y apoyado solo en el bloque DATOS y en las capacidades de STOCKALERT.
- Eliminado el flujo de consentimiento: `consentRequired` ya no se exige, se quitó el bloque de autorización del frontend y el campo `consent` del esquema. La respuesta siempre la genera OpenAI; no hay texto local de respaldo.
- `OPENAI_API_KEY` y `OPENAI_MODEL` creados en `.env` (ignorado por Git) y en `.env.example`; retiradas las variables y la clave de OpenRouter. La clave real debe pegarse en `.env` y configurarse solo en el backend de Vercel.
- Actualizadas las pruebas unitarias del chat, la prueba de API, el E2E opcional y toda la documentación para reflejar OpenAI y el nuevo flujo sin consentimiento.
- El módulo Asistente IA se simplificó a **solo chat**: se eliminaron las tarjetas de resumen, la tabla técnica y el desplegable de cálculo. El chat tiene burbujas redondeadas, avatares, preguntas rápidas y alto fijo con scroll.
- Corregidas las respuestas "feas": el prompt prohíbe Markdown, encabezados, negritas y listas; exige prosa natural en 2–4 frases, sin inventar ni combinar cifras. El backend elimina cualquier Markdown que el modelo devuelva y el frontend lo muestra como texto plano.
- El chat ocupa todo el alto del viewport: solo se desplaza el historial de mensajes y el campo de escritura queda siempre visible, sin tener que bajar con scroll. `AppLayout` marca la ruta `/ia` para aplicar este comportamiento sin afectar otros módulos.
- Corregidos los botones de acciones de `/superadmin`: la regla global `.row-actions button` los forzaba a 30×30 px (diseñada para iconos), por lo que las etiquetas “Editar”, “Ver usuarios”, “Contraseña” y “Desactivar” se apilaban verticalmente. El estilo de icono se aisló en `.row-actions--icons` para productos, categorías, proveedores y usuarios; `/superadmin` conserva botones de texto en una sola fila.
- El selector de establecimiento del formulario de usuarios usaba la misma búsqueda y paginación que la tabla, por lo que podía aparecer vacío. Ahora carga hasta 100 establecimientos activos de forma independiente y, al crear un usuario desde un filtro de establecimiento, ese valor se precarga.
- Corregida la pantalla legacy `/usuarios` (“Usuarios y permisos”): su modal “Nuevo usuario” no enviaba `establishmentId` (el backend lo exige y devolvía 400) y su tabla no mostraba el establecimiento. Ahora exige y envía el establecimiento, ofrece filtro/columna por comercio e incluye una vista agrupada por establecimiento con interruptor para volver al listado paginado.
- Corregido el agrupamiento: `publicUser()` devuelve `establishmentId`/`establishmentName` en camelCase, pero el frontend agrupaba con `establishment_id`/`establishment_name` (snake_case), por lo que TODOS los usuarios caían en “Sin establecimiento”. Se añadió `establishmentName` a la respuesta pública y se alinearon ambos listados (`/usuarios` y `/superadmin`). Verificado en Neon: solo el superadmin tiene `establishment_id = NULL`; los demás usuarios pertenecen a los establecimientos 1 y 2.
- La cuenta `SUPERADMINISTRADOR` aparece únicamente en el grupo “Sin establecimiento (superadministrador)” y no ofrece acciones: el backend ya rechazaba su modificación (`assertManageable`) y ahora la UI oculta Editar/Restablecer/Activar y bloquea cualquier intento de asignarle un establecimiento.
- Rediseño de administración general: una sola pantalla para gestionar comercios y cuentas. Se eliminó la página duplicada `UsersPage.jsx` y su entrada en Sidebar/Topbar; `/usuarios` ahora redirige a `/superadmin?tab=usuarios` (deep-link con `?tab=`). Se migraron a `/superadmin` la vista agrupada por establecimiento, el filtro por estado, la leyenda de roles y la autoprotección de la propia cuenta. Los filtros de establecimientos y usuarios son independientes para que buscar en una pestaña no afecte a la otra, y las acciones del encabezado cambian según la pestaña activa.
- Duplicidades eliminadas: 5 wrappers API repetidos en `endpoints.js` (ahora `usersApi` es la única fuente para cuentas) y 2 métodos sin uso; `ROLES` centralizado en `config/roles.js` a partir de `ROLE_LABELS`; `assertManager` unificado en `backend/src/utils/requireSuperAdmin.js` para usuarios y establecimientos.
- Eliminado el cambio obligatorio de contraseña en todo el software: ya no se devuelve ni se consulta `mustChangePassword`, no se redirige a `/perfil` tras el login, no se muestra el aviso de obligatoriedad y los alta/reset no marcan la cuenta para exigirlo. El cambio desde Perfil sigue siendo voluntario y continúa revocando las sesiones por `password_version`. Migración `009_remove_must_change_password.sql` añadida para limpiar la columna cuando se autorice su ejecución; el código funciona igual aunque la columna siga presente.
- Identificación visual del establecimiento: las cuentas con `establishmentId` ven una pastilla con icono y el nombre del comercio en la barra superior, en todas las pantallas y con adaptación a móvil. Se calcula desde `establishmentName` de `/auth/me` (con fallback al ID), sin nuevas peticiones ni cambios de permisos; el superadmin, que no tiene establecimiento, no la ve.

## Resultados reales finales

La última ronda de verificación se resume en las siete primeras filas; el resto corresponde a comprobaciones de fases anteriores y se conserva como histórico.

| Comprobación | Resultado |
| --- | --- |
| `npm run lint` | 0 errores y 0 advertencias en backend y frontend (ronda 2026-11-23) |
| `npm run test:permissions` | 4/4 pruebas OK del respaldo de permisos por rol (2026-11-23) |
| `npm run test:fields` | 6/6 pruebas OK de campos numéricos y COP (2026-11-23) |
| `npm run test:unit` sin base de datos | 4 archivos, 44/44 pruebas puras OK; URL local ficticia solo para el guard, sin conexión (2026-11-23) |
| `npm run build` | correcto, 2109 módulos (ronda 2026-11-23) |
| `npm run build --workspace=backend` contra Neon sin autorización | omite migraciones y termina correctamente; el deploy anterior había fallado en este paso |
| Login directo contra Neon | 3 usuarios operativos verificados por `auth.service.login`, sin localhost; superadmin sigue con rol global y sin tenant |
| E2E de redirect superadmin | No ejecutada en esta ronda (sin localhost); disponible con `E2E_BASE_URL` explícito |
| `npm test` con fixture local | 8 archivos, 99/99 pruebas OK (ronda anterior) |
| `npm install` (raíz, workspaces) | 486 paquetes añadidos, 17 eliminados; 9 avisos de auditoría de dependencias transitivas (ronda anterior) |
| `npm run test:unit` sin base de datos | 4 archivos, 44/44 pruebas puras (ronda anterior) |
| `npm run test:fields` | 6/6 pruebas de enteros, decimales de PostgreSQL, COP, borrado en vivo, cursor y ausencia de `type="number"` (ronda anterior) |
| `npm run dev` | arranque comprobado en ronda anterior; migraciones 005–008 aplicadas a Neon con autorización |
| E2E en desarrollo | 14/14 comprobaciones con credenciales de entorno, incluía respuestas del proveedor, historial, nueva conversación y descarga PDF (ronda anterior) |
| E2E numérico en navegador | 10/10 comprobaciones: Ctrl+A + Backspace/Delete, borrado uno por uno, reemplazo, dígitos intermedios, pegado, scroll, guardado y móvil (ronda anterior) |
| E2E de pestañas de movimientos | 10/10 comprobaciones: una sola pestaña activa, cambios repetidos, selección de productos, borrado de cantidades, stock, historial, alertas y responsive (ronda anterior) |
| E2E contra artefacto de producción en un solo puerto | 10/10 comprobaciones, sin errores de consola (ronda anterior) |
| Reportes PDF reales | 10/10 en `OK`: 1–8 páginas por reporte, fechas `dd/mm/aaaa`, COP sin decimales, 0 solapamientos (ronda anterior) |
| Estrés de PDFs | 250/600/120/300 filas, hasta 101 páginas, encabezados repetidos, 0 solapamientos, sin escribir en BD (ronda anterior) |
| Asistente / OpenAI | sin respuestas locales de respaldo; no requiere consentimiento; 401/402/403/429, timeout y errores de proveedor se rechazan; reintento único si la respuesta sale vacío; claves en el texto son sanitizadas; 0 secretos en frontend |
| Configuración Vercel Services | JSON válido, servicios `backend`/`frontend`, rewrites y fallback verificados; entrypoint Express sin `listen()` |
| Build del servicio frontend | `npm run build --workspace=frontend` correcto en ronda anterior |

La corrección global de campos numéricos sustituyó los 9 inputs `type="number"` por `IntegerInput` y `CurrencyInput`, reforzó los esquemas Zod con enteros estrictos y unificó el formato COP en tablas, dashboard, indicadores, vista previa de reportes, CSV y PDF. No se modificaron migraciones ni columnas de base de datos en esa corrección.

La corrección del borrado añadió `parseCurrencyEditing` para aceptar estados intermedios sin restaurar el valor anterior, movió la validación de rango a `blur`/submit y corrigió `digitsOnly` para conservar solo la parte entera de los valores `numeric` de PostgreSQL (`1250000.00` → `1250000`).

Se corrigió la lógica de pestañas de `MovementsPage.jsx`: el formulario de salida estaba dentro de la rama `tab === 'in'` y faltaba la rama `tab === 'out'`. Ahora `in`, `out` e `history` se renderizan condicionalmente de forma independiente, con el indicador azul controlado por el mismo estado. Se añadió `.movement-form` para centrar cada formulario sin duplicarlo y `npm run test:movements-e2e` con comprobaciones reales en navegador.

La verificación actual usa un fixture PostgreSQL local desechable. Ese motor **no es dependencia del proyecto** y sus datos no se eliminaron de forma permanente. Las pruebas toman sus credenciales de variables `TEST_*`/`E2E_*`; no hay cuentas ni contraseñas de demostración en documentación, código ni tests.

## Pendientes

- Despliegue del código multiempresa a Vercel: autorizado por el propietario, pero bloqueado por falta de CLI/sesión autenticada; hasta entonces la versión anterior no entiende los GUC/RLS y puede quedar incompatible con el esquema migrado.
- Alta de usuarios operativos del establecimiento 1 desde `/superadmin` (la cuenta heredada quedó como superadministrador global y sin tenant).
- Configuración de `OPENAI_API_KEY` y `OPENAI_MODEL=gpt-5.6-luna` solo en el servicio backend de Vercel; pegar la clave real en `.env` local sin versionarla.

## Limitaciones verificadas

- No se cargó el seed en Neon; el seed está deshabilitado. Las migraciones 005–008 sí se ejecutaron allí con autorización y se verificó la conservación de usuarios, categorías, proveedores, productos y movimientos.
- No hay cuenta/acceso a Vercel: no se afirma despliegue real. La configuración y el artefacto local sí fueron comprobados. La facturación de OpenAI depende de la clave que configure el propietario.
- La antigua clave de OpenRouter fue eliminada de `.env` en esta ronda; la nueva clave de OpenAI no se pegó en el repositorio ni se compartió en esta conversación.
- `.env` está ignorado por Git; el repositorio solo versiona `.env.example`, con `OPENAI_API_KEY` vacía y `OPENAI_MODEL=gpt-5.6-luna`.

## Estado final

La aplicación conserva autenticación, roles, productos, categorías, proveedores, movimientos IN/OUT, historial, alertas, indicadores, dashboard, gráficas, reportes CSV/PDF, usuarios y diseño responsive. Incluye la arquitectura multiempresa con panel `/superadmin`, los 10 reportes PDF rediseñados, los insights deterministas locales y el asistente conversacional con OpenAI como **única** fuente del texto del chat (sin fallback local), además de los campos numéricos/monetarios estandarizados con validación backend estricta.

El flujo de entrega es: copiar `.env.example` como `.env`, pegar la URL pooler de Neon, definir `JWT_SECRET` y, para el chat, `OPENAI_API_KEY` y `OPENAI_MODEL=gpt-5.6-luna` solo en el backend; ejecutar `npm install` y `npm run dev`; las migraciones 005–008 ya están aplicadas en Neon; crear establecimientos y cuentas desde `/superadmin`; y desplegar un único repositorio en Vercel con esas dos variables en el servicio backend. No existen credenciales demo: las pruebas usan variables de entorno `TEST_*`/`E2E_*` y un fixture local.
