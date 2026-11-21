# PROGRESS — STOCKALERT

Registro de avance y estado final del proyecto tras la refactorización a Neon + Vercel.

## Estado actual

STOCKALERT funciona con **una sola base de datos Neon**, **un único `.env` en la raíz**, **un solo comando de desarrollo** (`npm run dev`) y **un proyecto de Vercel**. Se conservaron todas las funcionalidades anteriores; el Asistente IA es un **copiloto conversacional** cuyo texto lo genera exclusivamente el modelo gratuito de OpenRouter. El motor determinista sigue siendo la fuente de cifras reales y solo prepara el contexto.

- Backend: 7 archivos de prueba, 70/70 pruebas superadas contra la base de datos de verificación.
- Sin base de datos: 4 archivos, 44/44 pruebas puras superadas.
- Frontend: lint limpio, build correcto y 14/14 comprobaciones E2E en navegador con clave real (más 10/10 numéricas y 10/10 de pestañas de movimientos).
- Reportes: los 10 PDF rediseñados generados y revisados página por página; 0 superposiciones en datos reales y de estrés.
- OpenRouter: solicitudes auténticas verificadas, tanto directas como mediante `POST /api/ia/chat`, con modelos `:free` y `usage.cost: 0`; sin respuestas locales ni tablas deterministas en el chat.
- Despliegue real en Neon/Vercel: **no ejecutado** desde este entorno (sin credenciales ni cuenta). La clave de OpenRouter expuesta en la conversación anterior debe rotarse y configurarse solo en el backend.

## FASE 1 — Análisis y planificación

**Estado:** COMPLETADA

- Monorepo con `backend/`, `frontend/`, `database/` y `docs/`.
- JWT con revocación por `jti`, tres roles y permisos verificados en backend.
- Alertas calculadas en SQL y concurrencia resuelta con `SELECT ... FOR UPDATE`.
- Primer administrador creado por script con variables de entorno.

## FASE 2 — Base de datos

**Estado:** COMPLETADA

- `001_init.sql`, `002_config.sql`, `003_fix_movement_type_length.sql` y `004_inventory_view.sql` conservados sin cambios.
- `fn_register_movement()` como única vía de entradas/salidas.
- `v_product_inventory` como fuente única de verdad de alertas, cobertura y valoración.
- Seed demo idempotente (10 productos, 313 movimientos, 4 usuarios), ahora bloqueado en producción.

## FASE 3 — Backend

**Estado:** COMPLETADA

- Express + Helmet + CORS + compresión + rate limiting + logger.
- Zod, manejo centralizado de errores, repositorios, servicios y controladores.
- Módulos: auth, users, categories, suppliers, products, movements, alerts, indicators, dashboard, reports e **ia**.
- CSV con BOM y PDF generados en memoria, sin escribir en disco.

## FASE 4 — Frontend React

**Estado:** COMPLETADA

- SPA con React Router, Axios relativo a `/api`, contexto de autenticación y notificaciones.
- Páginas de panel, productos, movimientos, alertas, indicadores, reportes, catálogos, usuarios y perfil.
- Diseño responsive y gráficas con Recharts.
- Nueva página **Asistente IA** (`/ia`) usando componentes y estilos existentes.

## FASE 5 — Pruebas y verificación

**Estado:** COMPLETADA

- Backend: Vitest + Supertest, 34 pruebas en 5 archivos.
- Frontend: Playwright Core con Microsoft Edge, 10 comprobaciones E2E.
- Verificación contra la base de datos de prueba disponible en el entorno; no se usaron mocks de BD.

## FASE 6 — Documentación

**Estado:** COMPLETADA

- README, instalación, arquitectura, base de datos, API, seguridad, alcance, manual de usuario y resultados reales de pruebas actualizados.
- Eliminadas las referencias a PostgreSQL local, Docker, imágenes/compose y entornos múltiples.
- Documentado el modelo IA local y la decisión que lo incorpora.

## FASE 7 — Refactorización a Neon y Vercel

**Estado:** COMPLETADA

- Eliminados `embedded-postgres`, `embeddedDb.js`, Dockerfiles, compose, `.dockerignore` y plantillas de entorno duplicadas.
- Único `.env` raíz cargado por backend, scripts de migración y orquestadores.
- Pool de API pequeño (`max: 5`), TLS verificado para `*.neon.tech` y URL directa derivada de `-pooler`.
- `migrate.js` usa URL directa, transacción por archivo y `pg_advisory_lock` para despliegues concurrentes.
- `backend/api/index.js` exporta la app Express sin `listen()`; es el entrypoint del servicio `backend` en Vercel Services.
- `vercel.json` usa el formato `services` con `backend` y `frontend`: enruta `/api` y `/api/*` al backend conservando el prefijo, `/health` al backend y el resto al frontend con fallback de React Router dentro de ese servicio.
- `npm run dev`: valida configuración, migra, levanta API y Vite, espera `/health`, abre el navegador y muestra errores comprensibles.
- Cada servicio instala y compila por separado. El build del servicio backend ejecuta las migraciones pendientes una vez por despliegue; el build del frontend solo compila la SPA.

## FASE 8 — Asistente IA local

**Estado:** COMPLETADA

- `GET /api/ia/insights?days=30&leadTimeDays=14&limit=8` con autenticación y permiso `indicators:read`.
- Serie diaria a partir de movimientos OUT reales; suavizado exponencial con tendencia atenuada.
- Stock de seguridad, punto de pedido, días de cobertura, riesgo, prioridad y narrativa resumida.
- Detección de picos atípicos mediante desviación estándar.
- Sin proveedores externos, sin `API_KEY` y sin envío de datos: todo se calcula en backend.
- Interfaz `/ia` integrada en menú, topbar y ruta protegida.

## FASE 9 — Reportes PDF y copiloto conversacional

**Estado:** COMPLETADA

- Rediseño de los 10 reportes: encabezado azul oscuro con STOCKALERT, título y fecha/hora en `es-CO`, filtros legibles, tabla con anchos fijos, encabezados repetidos, altura de fila adaptable, filas alternadas suaves, cifras a la derecha, texto a la izquierda y pie `Página X de Y` calculado en dos pasadas.
- A4 horizontal automático cuando hay 8+ columnas o 3+ columnas monetarias; resúmenes útiles por reporte; mismo formato COP/entero en PDF, CSV y vista previa.
- `AiInsightsPage.jsx` convertida en copiloto: resumen, recomendaciones, chat con historial, indicador de progreso, tablas pequeñas, preguntas rápidas, nueva conversación y consentimiento explícito antes de enviar datos agregados.
- Backend IA: `ai-chat.service.js` con intents, presupuesto determinista, validación de modelo gratuito (`openrouter/free`, `provider.max_price` en cero, costo 0 y modelo `:free`), timeout, `max_tokens`, `reasoning.effort: low`, límite por usuario y aviso exacto de IA fuera de servicio en 402/429/timeout/errores de proveedor.
- La clave solo existe en backend/Vercel como `OPENROUTER_API_KEY`; sin clave no se envían datos y el chat informa que la IA está temporalmente fuera de servicio. No hay variables `VITE_` con secretos ni modelos de pago/fallbacks.

## Resultados reales finales

| Comprobación | Resultado |
| --- | --- |
| `npm install` (raíz, workspaces) | 486 paquetes añadidos, 17 eliminados; 9 avisos de auditoría de dependencias transitivas |
| `npm run lint` | backend y frontend sin errores ni advertencias |
| `npm test` con base de datos de verificación | 7 archivos, 70/70 pruebas, 3,38 s |
| `npm run test:unit` sin base de datos | 4 archivos, 44/44 pruebas puras |
| `npm run test:fields` | 6/6 pruebas de enteros, decimales de PostgreSQL, COP, borrado en vivo, cursor y ausencia de `type="number"` |
| `npm run build` | correcto, 2107 módulos, 9,03 s, CSS 33,87 kB, chunks de React/Recharts/iconos separados |
| `npm run dev` | migraciones sin cambios, API y Vite listos, `/health` 200, navegador abierto en `http://localhost:5173` |
| E2E en desarrollo | 14/14 comprobaciones con clave real, incluye respuestas de OpenRouter, historial, nueva conversación y descarga PDF; sin errores de consola |
| E2E numérico en navegador | 10/10 comprobaciones: Ctrl+A + Backspace/Delete, borrado uno por uno, reemplazo, dígitos intermedios, pegado, scroll, guardado y móvil |
| E2E de pestañas de movimientos | 10/10 comprobaciones: una sola pestaña activa, cambios repetidos, selección de productos, borrado de cantidades, stock, historial, alertas y responsive |
| E2E contra artefacto de producción en un solo puerto | 10/10 comprobaciones, sin errores de consola |
| Reportes PDF reales | 10/10 en `OK`: 1–8 páginas por reporte, fechas `dd/mm/aaaa`, COP sin decimales, 0 solapamientos |
| Estrés de PDFs | 250/600/120/300 filas, hasta 101 páginas, encabezados repetidos, 0 solapamientos, sin escribir en BD |
| Copiloto / OpenRouter | sin respuestas locales; sin clave o ante errores muestra IA fuera de servicio; sin consentimiento no hay llamada; 402, 429, timeout y modelo de pago se rechazan; `reasoning.effort: low` y reintento gratuito si el contenido sale vacío; 6/6 llamadas auténticas consecutivas con modelos `:free` y costo 0; 0 secretos en frontend |
| Configuración Vercel Services | JSON válido, servicios `backend`/`frontend`, rewrites y fallback verificados; entrypoint Express sin `listen()` |
| Build del servicio frontend | `npm run build --workspace=frontend` correcto, 2107 módulos, 9,03 s |

La corrección global de campos numéricos sustituyó los 9 inputs `type="number"` por `IntegerInput` y `CurrencyInput`, reforzó los esquemas Zod con enteros estrictos y unificó el formato COP en tablas, dashboard, indicadores, vista previa de reportes, CSV y PDF. No se modificaron migraciones ni columnas de base de datos.

La corrección del borrado añadió `parseCurrencyEditing` para aceptar estados intermedios sin restaurar el valor anterior, movió la validación de rango a `blur`/submit y corrigió `digitsOnly` para conservar solo la parte entera de los valores `numeric` de PostgreSQL (`1250000.00` → `1250000`). Los productos creados en el E2E numérico se eliminaron al finalizar.

Se corrigió la lógica de pestañas de `MovementsPage.jsx`: el formulario de salida estaba dentro de la rama `tab === 'in'` y faltaba la rama `tab === 'out'`. Ahora `in`, `out` e `history` se renderizan condicionalmente de forma independiente, con el indicador azul controlado por el mismo estado. Se añadió `.movement-form` para centrar cada formulario sin duplicarlo y `npm run test:movements-e2e` con 10 comprobaciones reales en navegador, incluyendo entrada/salida, persistencia del stock, historial, alertas y responsive.

La verificación original con base de datos usó el PostgreSQL de prueba ya existente en `127.0.0.1:55432` como fixture temporal. Ese motor **no es dependencia del proyecto** y sus datos no se eliminaron.

Posteriormente el usuario configuró un `.env` apuntando a Neon. No se ejecutaron migraciones allí. Al correr `npm test` contra esa base sin datos demo, el resultado fue 4 archivos OK y 1 fallido (`api.test.js`, login demo 401); 20 pruebas pasaron y 14 se omitieron. Las pruebas de alertas y métricas crearon productos temporales y los limpiaron.

## Limitaciones verificadas

- No se ejecutaron migraciones en la Neon del usuario ni se cargó el seed allí.
- No hay cuenta/acceso a Vercel: no se afirma despliegue real. La configuración y el artefacto local sí fueron comprobados. `OPENROUTER_API_KEY` debe crearse en el entorno del servicio backend; no se activó facturación ni se usó un modelo de pago.
- La clave `sk-or-v1-…` mencionada en la conversación no se guardó ni se repitió; debe rotarse antes de usarla.
- `.env` está ignorado por Git; el repositorio solo versiona `.env.example`, con `OPENROUTER_API_KEY=` vacía.

## Estado final

La aplicación conserva autenticación, roles, productos, categorías, proveedores, movimientos IN/OUT, historial, alertas, indicadores, dashboard, gráficas, reportes CSV/PDF, usuarios y diseño responsive. Incluye los 10 reportes PDF rediseñados, el copiloto conversacional con modelo gratuito de OpenRouter (con motor local como respaldo y fuente de cifras) y los campos numéricos/monetarios estandarizados con validación backend estricta. El flujo de entrega es: copiar `.env.example` como `.env`, pegar la URL pooler de Neon, definir `JWT_SECRET` y, de forma opcional, `OPENROUTER_API_KEY` ya rotada en Vercel; ejecutar `npm install` y `npm run dev`, y desplegar un único repositorio en Vercel con `OPENROUTER_MODEL=openrouter/free`, `OPENROUTER_TIMEOUT_MS=12000` y `OPENROUTER_MAX_TOKENS=512` en el servicio backend.
