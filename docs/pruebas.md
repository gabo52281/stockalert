# Pruebas y verificación

Todos los resultados registrados aquí corresponden a comandos **ejecutados realmente** el 2026-11-20, 2026-11-21 y 2026-11-23. La verificación multiempresa se realizó contra una fixture PostgreSQL local/desechable en `127.0.0.1:55432`, donde se aplicaron primero las migraciones `005` a `008`. Con autorización explícita del propietario esas mismas migraciones se aplicaron también a Neon y se promovió `admin@su-dominio.com` a `SUPERADMINISTRADOR` sin tocar su contraseña; no se cargaron seeds en Neon ni se desplegó en Vercel. Esta pasada añade la verificación de aislamiento A/B, de los 10 reportes PDF rediseñados, del copiloto conversacional con OpenRouter gratuito (secciones 3, 8 y 9) y la regresión del acceso del superadministrador (sección 14). Ninguna clave de API ni credencial real se guardó en el repositorio ni en el frontend.

## 1. Entorno usado

- Node.js 24.20.0 y npm.
- Proyecto configurado con un único `.env` en la raíz.
- Base de datos de verificación: PostgreSQL existente en `127.0.0.1:55432`, base `stockalert`, usado **solo como fixture temporal**. No es dependencia del proyecto y sus datos no se eliminaron.
- API Express en `http://127.0.0.1:4000` en la verificación final (históricamente también se usó el puerto 4100).
- Frontend en `http://127.0.0.1:5173` mediante Vite, con proxy relativo `/api` a la API.
- Microsoft Edge headless mediante `playwright-core`; PyMuPDF para renderizar y revisar cada página de los PDF.

## 2. Instalación

Comando: `npm install` en la raíz.

Resultado: 486 paquetes añadidos, 17 eliminados, 497 auditados. npm informó 9 vulnerabilidades en dependencias transitivas (5 moderadas, 2 altas, 2 críticas) y avisos de paquetes con scripts de instalación no cubiertos por `allowScripts`. No se aplicó `npm audit fix --force` porque cambia versiones de forma rompiente.

Se eliminaron los lockfiles anidados de `backend/` y `frontend/`; la raíz conserva el único `package-lock.json` de workspaces.

## 3. Backend — Vitest + Supertest

Comando: `npm test` en la raíz, con `DATABASE_URL` y `DIRECT_URL` apuntando al fixture local (`postgresql://postgres:postgres@127.0.0.1:55432/stockalert`) y credenciales de esa fixture suministradas por entorno (`TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_CONSULTA_EMAIL`, `TEST_CONSULTA_PASSWORD`). No existen credenciales demo en el código.

Resultado real de la pasada final:

```text
Test Files  8 passed (8)
Tests       98 passed (98)
Duration    6.28s
```

Ronda del 2026-11-23, **sin pruebas en localhost**: `npm run lint` terminó con 0 errores; `npm run test:permissions` 4/4; `npm run test:fields` 6/6; `npm run test:unit` 4 archivos / 44 pruebas puras con una URL local ficticia solo para el guard (sin servidor ni conexión); y `npm run build` compiló 2109 módulos. Las integraciones con fixture local quedan documentadas arriba como historial, pero no se repitieron en esta ronda.

Cobertura:

| Archivo | Comprobaciones |
| --- | --- |
| `tests/tenant-security.test.js` (28) | login con permisos inmediatos; A/B sin fuga en productos, categorías, proveedores, movimientos, dashboard, alertas, indicadores, reportes, IA y configuración; IDs cross-tenant devuelven 404; `tenant_id` del frontend ignorado; validación de relaciones; concurrencia de inventario; superadmin sin inventario ni IA; reset y desactivación; sin exponer hashes |
| `tests/api.test.js` (15) | `/health`; login inválido 401; ruta privada sin token 401; permiso de rol 403; validación Zod 400; creación de producto stock 0; entrada con stock anterior/resultante; salida con stock resultante; exceso de salida 409; historial conservado; resumen de alertas; dashboard e indicadores; **`/api/ia/insights` con datos reales**; **`/api/ia/status` sin secretos y `/api/ia/chat` sin texto local**; JSON/CSV/PDF con resumen y BOM; logout con token revocado |
| `tests/ai.test.js` (7) | normalización de serie; sin historial; demanda constante y tendencia; detección de pico atípico; sugerencia de reposición y riesgo; sin reposición cuando hay cobertura; resumen priorizado |
| `tests/ai-chat.test.js` (14) | presupuestos colombianos y plan entero; intenciones; contexto con cifras reales; estado sin secretos; sin clave y sin consentimiento sin respuesta local; 402/429/timeout; modelo de pago rechazado; respuesta gratuita aceptada y claves sanitizadas; reintento gratuito con contenido vacío |
| `tests/alerts.test.js` (6) | `AGOTADO`, `CRITICO`, `BAJO`, `NORMAL`, mínimo 0 y porcentaje por producto |
| `tests/metrics.test.js` (4) | promedio/cobertura, `INSUFICIENTE`, `NO_CALCULABLE`, valoración |
| `tests/validation.test.js` (21) | enteros y cadenas de dígitos aceptados; rechazo de decimales, negativos, notación científica, comas y vacío en precios, stock, porcentajes y días; cantidades > 0; formato COP de reportes sin decimales; `formatFilterValue` convierte fechas ISO a `dd/mm/aaaa` |
| `tests/neon.test.js` (3) | derivación de URL directa, respeto de `DIRECT_URL`, TLS verificado y `max: 5` |

### Pruebas sin base de datos

Con el `.env` temporalmente fuera del proyecto, `npm test` ejecuta solo las pruebas puras:

```text
Test Files  2 passed (2) | 3 skipped (3)
Tests       10 passed (10) | 24 skipped (24)
Duration    1.23s
```

Esto confirma que la raíz puede ejecutar `npm test` sin PostgreSQL siempre que no se configure `DATABASE_URL`; las integraciones se omiten en lugar de fallar.

Nota: Vitest muestra un aviso informativo sobre el build CJS de la API de Vite; no afecta a los resultados.

En la pasada final, `npm run test:unit` ejecuta 4 archivos y totaliza **44/44 pruebas puras** (7 de IA determinista, 13 del copiloto, 21 de validación/formato y 3 de Neon), sin requerir base de datos.

**Verificación posterior con una Neon recién creada:** la suite de integración omite sus bloques de base si no se definen `DATABASE_URL` o las credenciales `TEST_*`/`E2E_*`; no hay usuarios ni contraseñas demo incrustados. Con autorización explícita se aplicaron las migraciones `005`–`008` a Neon y se promovió manualmente `admin@su-dominio.com` a `SUPERADMINISTRADOR`; la contraseña no se modificó. La verificación funcional posterior contra Neon y el despliegue siguen pendientes.

## 4. Lint

Comando: `npm run lint` en la raíz (backend y frontend).

Resultado: ESLint terminó sin errores ni advertencias.

Durante la verificación final se corrigieron dos regresiones detectadas por lint/E2E:

- `Button` dejó de propagar `fullWidth` como atributo DOM inválido y lo transforma en la clase `btn--block`.
- `vite.config.js` declara `process` como global para ESLint al leer `PORT` desde el entorno.

## 5. Build

Comando: `npm run build` en la raíz.

Resultado real de la pasada final: compilación correcta de 2108 módulos en 9,57 s.

```text
index.html                  1.11 kB │ gzip:   0.60 kB
assets/index-*.css         33.70 kB │ gzip:   7.37 kB
assets/icons-*.js          27.87 kB │ gzip:   5.74 kB
assets/index-*.js         337.04 kB │ gzip:  64.94 kB
assets/react-*.js         346.02 kB │ gzip: 107.91 kB
assets/charts-*.js        438.05 kB │ gzip: 119.22 kB
```

Sin errores ni advertencias de tamaño gracias a la separación manual de chunks.

## 6. `npm run dev`

Comando: `npm run dev` en la raíz, con `.env` de verificación.

Salida relevante observada:

```text
Verificando configuración y aplicando migraciones pendientes...
No hay migraciones pendientes.
VITE v6.4.6 ready in 778 ms
WEB listo en http://127.0.0.1:5173/
STOCKALERT API escuchando en http://localhost:4000
API listo en http://127.0.0.1:4000/health
STOCKALERT listo: http://localhost:5173
```

Durante la sesión se registraron respuestas `GET /api/ia/insights?days=30&leadTimeDays=14 → 200`. El proceso se terminó deliberadamente al finalizar la verificación.

## 7. E2E en navegador

Comando: `npm run test:e2e --workspace=frontend`, con `E2E_BASE_URL=http://127.0.0.1:5173`, `E2E_EMAIL`, `E2E_PASSWORD` y `E2E_HOME_PATH` tomados de credenciales de la fixture local definidas explícitamente en el entorno. Las pruebas ya no contienen fallbacks demo y fallan con mensaje claro si faltan esas variables.

Salida real de la pasada final:

```text
1. Login renderizado correctamente
2. Autenticación y panel principal cargados
3. Indicadores y gráficas con datos reales: 29 | 908 | 13 | $ 5.112.400
4. Productos: 10 filas visibles
5. Módulo de alertas cargado con filas reales
6. Módulo de indicadores cargado con cobertura real
7. Copiloto con recomendaciones reales cargado
8. Estado del chat: OpenRouter disponible
9. Respuesta mostrada solo desde OpenRouter o aviso de servicio no disponible
10. Segunda pregunta conserva el historial
11. Nueva conversación reinicia el historial
12. Reportes con vista previa y descarga PDF: stockalert-inventory-2026-11-20.pdf
13. Logout y redirección verificados
14. Diseño responsive en 390 px verificado

E2E: 14 comprobaciones superadas, sin errores de JavaScript.
```

La prueba comprueba que no haya errores de consola ni excepciones de página. El paso 8 solo confirma que hay clave configurada: si OpenRouter agota cuota, devuelve un modelo no gratuito o cae, el paso 9 acepta exclusivamente el aviso oficial **IA temporalmente fuera de servicio** y nunca una respuesta local o de pago. Durante las pasadas se detectaron y corrigieron errores reales: `aiApi.chat` devolvía `{ data: ... }` y el componente intentaba `response.text.split(...)`; el badge se leía antes de que resolviera `/api/ia/status`; Reportes/Movimientos consultaban el listado privado `/api/users` y generaban dos `403` en consola, sustituido por `/api/users/options`; y el timeout HTTP de la SPA era menor que el tiempo permitido al proveedor. Todo quedó corregido. Anteriormente la misma suite se ejecutó contra el artefacto de producción servido por `npm start` con 10/10 comprobaciones.

### E2E específico de campos numéricos

Comando: `npm run test:numeric-e2e --workspace=frontend`, con `E2E_BASE_URL=http://127.0.0.1:5173`, `E2E_EMAIL` y `E2E_PASSWORD` contra un servidor de desarrollo apoyado en el fixture local.

Salida real:

```text
1. Ctrl+A + Backspace y Ctrl+A + Delete dejan el precio vacío
2. Borrado dígito por dígito y escritura posterior: $ 50.000
3. Reemplazo completo y borrado de dígitos intermedios sin restauración
4. Pegado con/sin formato, rechazo de decimales y negativos
5. Cantidades: borrado total, reemplazo y rechazo de decimales/negativos
6. La rueda desplaza la página sin cambiar cantidades y el borrado funciona
7. Producto creado con precios nuevos y valores guardados correctamente
8. Edición de producto existente carga y conserva los valores COP
9. Producto de prueba eliminado después de verificar la persistencia
10. Diseño responsive conservado en 390 px

E2E numérico: 10 comprobaciones superadas, sin errores de JavaScript.
```

Además, `npm run test:fields` ejecuta 6 pruebas puras: enteros, normalización de decimales devueltos por PostgreSQL, formato COP en vivo, estados intermedios de borrado, pegado con formato, cursor y ausencia de `type="number"` en los formularios.

### E2E específico de pestañas de movimientos

Comando: `npm run test:movements-e2e --workspace=frontend`, con `E2E_BASE_URL=http://127.0.0.1:5173`, `E2E_EMAIL` y `E2E_PASSWORD` contra un servidor de desarrollo apoyado en el fixture local.

Salida real:

```text
1. Registrar entrada muestra únicamente Nueva entrada
2. Registrar salida muestra únicamente Nueva salida
3. Historial muestra únicamente filtros, tabla y paginación
4. Entrada → Salida → Entrada funciona sin estados residuales
5. Productos seleccionables y cantidades editables/borrables
6. Entrada registrada: stock aumentado y alertas actualizadas
7. La entrada aparece en el historial
8. Salida registrada: stock descontado y alertas actualizadas
9. La salida aparece en el historial
10. Diseño responsive conservado y sin errores de JavaScript

E2E de pestañas: 10 comprobaciones superadas.
```

La causa era que el componente `Nueva salida` estaba incluido dentro de la condición `tab === 'in'` y no existía una rama `tab === 'out'`. Ahora las tres pestañas usan renderizado condicional de React: `in`, `out` e `history`. El indicador azul depende de la misma variable de estado `tab`.

## 7.1 Migraciones multiempresa y aislamiento A/B

- Se aplicaron primero a la fixture local y, con autorización explícita, a Neon: `005_multi_tenant.sql`, `006_tenant_foreign_keys.sql`, `007_tenant_defaults.sql` y `008_harden_tenant_boundaries.sql`. Antes de aplicarlas se validaron las cuatro con `ROLLBACK` contra el esquema real de Neon; la primera pasada de `005` falló por una política inválida sobre `establishments` y fue corregida sin dejar cambios parciales.
- La migración `008` endurece las políticas RLS para que `SUPERADMINISTRADOR` no consulte inventario, valida `user_id` y `supplier_id` dentro de `fn_register_movement()` y crea la FK compuesta movimientos↔usuario solo cuando los datos son consistentes.
- `tests/tenant-security.test.js` ejecuta 29 comprobaciones con dos establecimientos A/B: listados, detalle, edición, borrado, movimientos, categorías, proveedores, dashboard, alertas, indicadores, reportes, configuración y copiloto IA. Incluye además concurrencia sobre el mismo producto, `tenant_id` falso en el body, promoción/reset de contraseña, desactivación de establecimiento y el endpoint aislado `/api/users/options`.
- Resultado: 29/29 comprobaciones superadas. Antes de añadir los predicados SQL explícitos fallaban 10; la causa raíz era que el rol de conexión local/Neon puede omitir RLS aunque exista `FORCE ROW LEVEL SECURITY`.
- El seed demo quedó deshabilitado: `npm run seed` termina con un aviso y no crea usuarios ni datos.

## 8. Verificación de los 10 reportes PDF rediseñados

- Se generaron JSON, PDF y CSV reales de los 10 reportes desde `/api/reports/:name?format=...` contra el fixture local, usando `from=2026-10-22T00:00:00` y `to=2026-11-20T23:59:59` en los reportes de movimientos.
- Cada PDF se renderizó página por página a PNG con PyMuPDF y se comprobó: encabezado azul con STOCKALERT, título, fecha/hora, filtros legibles, tabla alineada, encabezados repetidos en cada página, pie `Página X de Y`, cero superposiciones y cero cortes.
- `verify_content.py` validó además que JSON, PDF y CSV coincidan en filas, que las fechas aparezcan como `dd/mm/aaaa` y que el dinero usa formato COP sin decimales.

Resultado real (los 10 en `OK`):

```text
coverage             OK  páginas=1  filas=29
critical             OK  páginas=1  filas=6
inventory            OK  páginas=3  filas=29
low-stock            OK  páginas=1  filas=7
movements-by-user    OK  páginas=8  filas=79
movements-in         OK  páginas=4  filas=37
movements-out        OK  páginas=5  filas=42
movements-range      OK  páginas=8  filas=79
top-products         OK  páginas=1  filas=29
valuation            OK  páginas=2  filas=29
```

- Prueba de estrés sintética, sin escribir en la base de datos: `inventario` 250 filas/21 páginas, `movimientos` 600 filas/101 páginas, `criticos` 120 filas/6 páginas y `valoracion` 300 filas/19 páginas. Las 101 páginas de movimientos repiten los 10 encabezados; 0 solapamientos; ningún filtro ISO queda sin convertir; la orientación horizontal se activa automáticamente por número de columnas/columnas monetarias.
- Durante la verificación se corrigieron: el error `column "product_code" does not exist`, páginas vacías por pie fuera del margen, `switchToPage(3) out of bounds`, el solapamiento del resumen con la columna `Proveedor` y las fechas ISO visibles en los filtros.

## 9. Copiloto conversacional exclusivamente con OpenRouter

- **Ya no existen respuestas de chat generadas por reglas locales.** Se eliminaron `localAnswer` y las tablas deterministas de la respuesta del chat. Los cálculos internos siguen consultando Neon, calculando existencias y preparando el resumen agregado que se envía como contexto; nunca redactan la respuesta.
- `GET /api/ia/status` sin clave devuelve `{"externalModelAvailable":false,"mode":"unavailable","model":null}`, sin exponer secretos. La interfaz muestra **IA temporalmente fuera de servicio**.
- `POST /api/ia/chat`: sin clave, o ante 402/429/timeout/error de proveedor/modelo de pago, devuelve exactamente: `La IA está temporalmente fuera de servicio. Intenta nuevamente más tarde. Puedes consultar las recomendaciones automáticas de STOCKALERT.` No se sustituye por texto simulado.
- Sin `consent: true` no se contacta al proveedor y la respuesta es solo un aviso de consentimiento (`text: ''`), nunca una respuesta redactada localmente.
- La petición, simulada con `global.fetch` en `tests/ai-chat.test.js`, usa `model: "openrouter/free"`, **no** envía array `models` de respaldo, fija `provider.max_price: {prompt: 0, completion: 0}`, `reasoning: {effort: "low"}`, `max_tokens: 512` (512 en el primer intento, hasta 1024 en un único reintento si el modelo gratuito devuelve contenido vacío por agotar tokens en razonamiento), timeout de 12 s y contexto máximo de 3500 caracteres. La cabecera `Authorization` se construye desde `env.OPENROUTER_API_KEY`.
- Verificación de configuración: al iniciar un proceso con `OPENROUTER_API_KEY` definida en el entorno, `config/env.js` la carga (`keyDesdeEntorno=true`, `modelo=openrouter/free`, `timeout=12000`, `maxTokens=512`) y `status()` pasa a `mode=ia` sin exponer campos con la clave.
- **Solicitudes auténticas ejecutadas** contra `https://openrouter.ai/api/v1/chat/completions` con la clave configurada en `.env`: la llamada directa devolvió modelos `:free` (`nvidia/nemotron-3-ultra-550b-a55b:free`, `nvidia/nemotron-3.5-super-vl:free`, `recursive/flint-v1.0:free`) y `usage.cost: 0`. A través de `POST /api/ia/chat` con consentimiento, tres llamadas reales devolvieron `providerUsed: true`, modelos `:free` y texto basado en cifras reales de Neon (tiempos 19,8 s, 8,6 s y 8,3 s). Sin consentimiento: `consentRequired: true`, `providerUsed: false`, `text: ''`. La clave nunca se imprimió ni se incluyó en las respuestas.
- Durante la verificación real apareció un caso de modelos gratuitos que devolvían contenido vacío por consumir los tokens en razonamiento. Se corrigió con `reasoning: {effort: "low"}` y un único reintento con el mismo `openrouter/free` y más tokens, sin modelos de pago. Tras el ajuste, 6/6 solicitudes auténticas consecutivas devolvieron texto visible (295–464 caracteres) con modelos `:free`. No se activó facturación.
- El chat no expone SQL, no tiene herramientas de escritura y el prompt prohíbe modificar, crear o borrar inventario.
- Búsqueda en `frontend/`: 0 coincidencias de `sk-or-v1-`, `OPENROUTER_API_KEY` ni variables `VITE_` con secretos. La clave quedó configurada solo en `.env` del backend local; **la clave compartida en la conversación anterior debe rotarse** antes de usarla en Vercel.

## 10. Configuración de Vercel Services verificada localmente

- `vercel.json` es JSON válido y usa el formato `services` con `backend` y `frontend`, sin comandos globales de build.
- Cada servicio declara su propio `installCommand` y `buildCommand`: `backend` ejecuta las migraciones pendientes una vez por despliegue; `frontend` compila la SPA en `dist`.
- Los rewrites raíz envían `/api`, `/api/*` y `/health` al servicio `backend` y el resto al servicio `frontend`. El fallback a `/index.html` está dentro del servicio frontend.
- No hay `bindings`: el navegador llama a `/api` en el mismo dominio.
- `backend/api/index.js` exporta la app Express; al importarla con `VERCEL=1` y variables de entorno de prueba no se llama a `listen()` y el proceso termina.
- Validación en checkout limpio: `npm install --dry-run` desde `backend/` resolvería 331 paquetes y desde `frontend/` 320, usando el workspace raíz del repositorio.
- `npm run build --workspace=frontend` compila la SPA correctamente (2108 módulos, 9,57 s en la última pasada).
- En `app.js`, el sirvido estático de `frontend/dist` se desactiva cuando `VERCEL` está definido, porque la plataforma sirve los archivos.
- El bundle de frontend usa `baseURL: '/api'`; no aparece `VITE_API_URL` ni secretos en el código compilado.

Comprobación adicional: el endpoint IA devolvió un narrative real en la base de datos de verificación:

```text
Se analizaron 10 productos activos. 2 tienen riesgo alto o crítico y 5 necesitan reposición.
La inversión estimada para cubrir la demanda de 14 días es 236200.
```

## 11. Corrección global de campos numéricos y monetarios

- Componentes nuevos: `IntegerInput` y `CurrencyInput`, ambos controlados y con `type="text"` / `inputMode="numeric"`.
- Se eliminaron los 9 campos `type="number"` existentes: 7 en `ProductsPage` y 2 en `MovementsPage`. Ya no existe ningún input numérico nativo en `frontend/src`.
- Precios: formato COP en vivo (`$ 1.250.000`), sin decimales ni comas; el estado conserva solo dígitos y la API recibe números.
- Cantidades y stock mínimo: solo dígitos; se rechazan decimales, negativos y notación científica. Las cantidades de movimiento exigen valor ≥ 1.
- Backend: `productCreateSchema`, `productUpdateSchema`, esquemas de movimiento y configuración de alertas validan enteros estrictos. Los porcentajes y días también son enteros dentro de rango.
- Reportes: la vista previa usa `formatCurrency`; CSV y PDF usan el mismo formateador COP del backend, sin decimales.
- No se modificaron migraciones ni columnas de base de datos; la validación reforzada está en la capa API.

### Corrección definitiva del borrado

- Causa 1: el analizador estricto de COP rechazaba estados intermedios como `$ 1.250.00` o `$ 1.20.000`; el componente no propagaba el cambio y React restauraba el valor controlado.
- Causa 2: `normalizeDigits` eliminaba el punto de los valores `numeric` de PostgreSQL (`1250000.00` → `125000000`), de modo que reabrir un producto mostraba el precio multiplicado.
- Solución: `parseCurrencyEditing` acepta estados intermedios de borrado sin devolver nunca el valor anterior; `digitsOnly` conserva únicamente la parte entera de los decimales devueltos por la base; ambos componentes validan rangos en `blur`/submit con `setCustomValidity` y `required`, sin bloquear la escritura.
- El formulario del padre sigue recibiendo solo cadenas de dígitos o `''`; `apiNumber` convierte a número para la API y nunca sustituye el vacío por cero.

## 12. Limitaciones

- No se ejecutaron seeds en la Neon configurada por el usuario. Las migraciones `005`–`008` y la promoción explícita del superadministrador sí se ejecutaron allí con autorización; la verificación completa de regresión se realizó contra el fixture local `127.0.0.1:55432`.
- No se dispuso de cuenta/acceso a Vercel: **no se realizó un despliegue real**. Solo se verificó la configuración y el artefacto local. La clave de OpenRouter debe configurarse como `OPENROUTER_API_KEY` en el entorno del backend de Vercel; nunca como variable `VITE_`.
- La clave `sk-or-v1-…` aparecida en la conversación no se guardó ni se repitió. Debe considerarse comprometida y **rotarse** antes de configurarla en Vercel.
- Sin clave, el copiloto no envía datos a proveedores externos y muestra el aviso de IA fuera de servicio; no genera respuestas de chat por reglas locales. Con consentimiento y clave, envía contexto agregado del establecimiento a OpenRouter; nunca SQL, secretos ni datos de otro tenant. No se activó facturación ni se usó ningún modelo de pago.
- No se borraron datos de producción. En la fixture local sí se aplicaron DDL de migración y se crearon/eliminaron registros temporales de pruebas A/B; nada de eso se replicó a Neon.

## 13. Repetir la verificación

```bash
# Configuración inicial
cp .env.example .env
# Editar DATABASE_URL (pooler de Neon), DIRECT_URL y JWT_SECRET.
# Opcional: OPENROUTER_API_KEY solo en backend/Vercel (nunca VITE_*).

npm install
npm run lint
npm run test:unit
npm test
npm run build
npm run dev

# En otra terminal, contra el modo desarrollo (PowerShell).
# Use SOLO credenciales de una fixture local/desechable.
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/stockalert'
$env:DIRECT_URL=$env:DATABASE_URL
$env:TEST_ADMIN_EMAIL='admin@fixture.local'
$env:TEST_ADMIN_PASSWORD='valor-de-la-fixture'
$env:TEST_CONSULTA_EMAIL='consulta@fixture.local'
$env:TEST_CONSULTA_PASSWORD='valor-de-la-fixture'
$env:E2E_BASE_URL='http://127.0.0.1:5173'
$env:E2E_EMAIL=$env:TEST_ADMIN_EMAIL
$env:E2E_PASSWORD=$env:TEST_ADMIN_PASSWORD
$env:E2E_HOME_PATH='/'
$env:E2E_SUPERADMIN_EMAIL='superadmin@fixture.local'
$env:E2E_SUPERADMIN_PASSWORD='valor-de-la-fixture'
npm run test:e2e --workspace=frontend
npm run test:superadmin-e2e --workspace=frontend
npm run test:permissions
npm run test:fields
npm run test:numeric-e2e --workspace=frontend
npm run test:movements-e2e --workspace=frontend

# Artefacto de un solo puerto
npm start
$env:E2E_BASE_URL='http://localhost:4000'
npm run test:e2e --workspace=frontend
```

Las integraciones se activan cuando hay `DATABASE_URL` **y** las credenciales `TEST_*`. Para aplicar migraciones de forma explícita: `npm run migrate` (en una base no local exige `ALLOW_PRODUCTION_MIGRATION=true` y autorización del propietario). `npm run seed` está deshabilitado a propósito.

Variables nuevas del copiloto: `OPENROUTER_API_KEY` (solo servidor; vacía = IA fuera de servicio), `OPENROUTER_MODEL=openrouter/free`, `OPENROUTER_TIMEOUT_MS=12000` y `OPENROUTER_MAX_TOKENS=512`. En Vercel deben ir en la sección de variables de entorno del servicio **backend**; el frontend no necesita ninguna.

## 14. Regresión del acceso del superadministrador

**Síntoma reportado:** al iniciar sesión con la cuenta `SUPERADMINISTRADOR` aparecían `No tiene permisos para acceder a este módulo` y `Su rol no autoriza esta operación. Contacte al administrador si lo considera necesario.`

**Causa:** `LoginPage.jsx` priorizaba `location.state?.from?.pathname` (normalmente `/`) por encima de `homePathFor(loggedUser)`, y un `/auth/me` de una versión anterior podía llegar sin `permissions`. Como el superadministrador no tiene permisos de inventario por diseño, cualquier ruta distinta de `/superadmin` —o una lista de permisos vacía— terminaba en la pantalla de acceso denegado.

**Corrección:**
- `frontend/src/pages/LoginPage.jsx`: el login siempre navega a `homePathFor(loggedUser)`.
- `frontend/src/routes/ProtectedRoute.jsx`: si un superadministrador intenta una ruta sin permiso, se le redirige a `/superadmin` en lugar de a `/acceso-denegado`.
- `frontend/src/components/layout/AppLayout.jsx`: solo consulta `/api/alerts/summary` cuando existe `alerts:read`, evitando un 403 al cargar el panel.
- `frontend/src/components/layout/Topbar.jsx`: la campana de alertas se oculta sin `alerts:read`.
- `frontend/src/pages/ForbiddenPage.jsx`: «Volver a mi panel» lleva al home del rol, no siempre a `/`.
- `backend/src/controllers/auth.controller.js` y `frontend/src/config/permissions.js`: `/auth/me` respalda la lista de permisos con `permissionsFor(role)` y el frontend usa esa misma matriz solo cuando el backend no envía permisos, evitando que un backend anterior deje al superadministrador sin menú. El backend sigue siendo la autoridad y el inventario continúa vedado al superadministrador.

**Verificación de esta ronda (sin localhost):** los permisos del superadministrador se comprobaron con `npm run test:permissions` (4/4) y con consultas directas a Neon: su rol sigue siendo `SUPERADMINISTRADOR`, sin establecimiento asignado, con `users:read`/`establishments:read` y sin `products:read`/`movements:create`. El login de los tres nuevos usuarios se verificó con `auth.service.login` contra Neon, sin iniciar servidor ni navegador. No se repitieron pruebas E2E en `127.0.0.1`.

**Prueba unitaria de permisos:** `npm run test:permissions` ejecuta `frontend/tests/permissions.test.mjs`: **4/4 pruebas OK**. Cubre el respaldo de permisos del superadministrador, el respeto a la lista del backend, los roles de inventario y un rol desconocido sin permisos.

**Prueba versionada:** `frontend/tests/superadmin-redirect-e2e.mjs`, disponible con `npm run test:superadmin-e2e`. Comprueba: (1) ruta protegida sin sesión redirige al login, (2) el login termina en `/superadmin` con el encabezado «Administración general», (3) ausencia de los textos de acceso denegado, (4) una URL directa a `/` devuelve al panel de superadministración, (5) ninguna respuesta HTTP 403 y ningún error de consola. Requiere `E2E_BASE_URL` explícito (producción u otro entorno autorizado), además de `E2E_SUPERADMIN_EMAIL` y `E2E_SUPERADMIN_PASSWORD`; no tiene valor localhost por defecto y no contiene credenciales incrustadas. No se ejecutó en esta ronda.
