# Pruebas y verificación

Todos los resultados registrados aquí corresponden a comandos **ejecutados realmente** el 2026-11-20. No se ejecutaron migraciones en Neon ni despliegue en Vercel. La conexión a Neon solo se ejerció al ejecutar la suite con el `.env` configurado por el usuario, tal como se detalla en la sección 3. Esta pasada final añade la verificación de los 10 reportes PDF rediseñados y del copiloto conversacional con OpenRouter gratuito (sección 8 y 9). Ninguna clave de API se guardó en el repositorio ni en el frontend.

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

Comando: `npm test` en la raíz, con `DATABASE_URL` y `DIRECT_URL` apuntando al fixture local (`postgresql://postgres:postgres@127.0.0.1:55432/stockalert`) y credenciales demo `admin@stockalert.local` / `Demo1234!`.

Resultado real de la pasada final:

```text
Test Files  7 passed (7)
Tests       69 passed (69)
Duration    3.13s
```

Cobertura:

| Archivo | Comprobaciones |
| --- | --- |
| `tests/api.test.js` (15) | `/health`; login inválido 401; ruta privada sin token 401; permiso de rol 403; validación Zod 400; creación de producto stock 0; entrada con stock anterior/resultante; salida con stock resultante; exceso de salida 409; historial conservado; resumen de alertas; dashboard e indicadores; **`/api/ia/insights` con datos reales**; **`/api/ia/status` y `/api/ia/chat` sin proveedor, con rechazo de modificaciones de inventario**; JSON/CSV/PDF con resumen y BOM; logout con token revocado |
| `tests/ai.test.js` (7) | normalización de serie; sin historial; demanda constante y tendencia; detección de pico atípico; sugerencia de reposición y riesgo; sin reposición cuando hay cobertura; resumen priorizado |
| `tests/ai-chat.test.js` (13) | presupuestos colombianos y plan entero; intenciones; explicaciones locales; tabla pequeña; rechazo de modificar inventario; estado sin secretos; consentimiento; 402/429/timeout; modelo de pago rechazado; respuesta gratuita aceptada y claves sanitizadas |
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

**Verificación posterior con una Neon recién creada:** al ejecutar `npm test` con el `.env` apuntando a la Neon configurada por el usuario (sin datos demo), `tests/api.test.js` falla en `beforeAll` porque espera `admin@stockalert.local` / `Demo1234!`. Resultado real: 4 archivos OK, 1 fallido; 20 pruebas superadas, 14 omitidas. Los otros 4 archivos (`ai`, `alerts`, `metrics`, `neon`) pasan. No es una regresión del cambio de Vercel Services: la suite de API necesita una base con datos demo (o credenciales de prueba equivalentes). No se cargó el seed en esa base.

## 4. Lint

Comando: `npm run lint` en la raíz (backend y frontend).

Resultado: ESLint terminó sin errores ni advertencias.

Durante la verificación final se corrigieron dos regresiones detectadas por lint/E2E:

- `Button` dejó de propagar `fullWidth` como atributo DOM inválido y lo transforma en la clase `btn--block`.
- `vite.config.js` declara `process` como global para ESLint al leer `PORT` desde el entorno.

## 5. Build

Comando: `npm run build` en la raíz.

Resultado real de la pasada final: compilación correcta de 2107 módulos en 8,19 s.

```text
index.html                  1.11 kB │ gzip:   0.60 kB
assets/index-*.css         33.67 kB │ gzip:   7.36 kB
assets/icons-*.js          26.61 kB │ gzip:   5.46 kB
assets/index-*.js         300.46 kB │ gzip:  60.45 kB
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

Comando: `npm run test:e2e --workspace=frontend`, con `E2E_BASE_URL=http://127.0.0.1:5173`, `E2E_EMAIL` y `E2E_PASSWORD` tomados de `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` del `.env`.

Salida real de la pasada final:

```text
1. Login renderizado correctamente
2. Autenticación y panel principal cargados
3. Indicadores y gráficas con datos reales: 29 | 908 | 13 | $ 5.112.400
4. Productos: 10 filas visibles
5. Módulo de alertas cargado con filas reales
6. Módulo de indicadores cargado con cobertura real
7. Copiloto con recomendaciones reales cargado
8. Chat respondió y conservó el historial
9. Plan dentro de presupuesto con tabla pequeña
10. Nueva conversación reinicia el historial
11. Reportes con vista previa y descarga PDF: stockalert-inventory-2026-11-20.pdf
12. Logout y redirección verificados
13. Diseño responsive en 390 px verificado

E2E: 13 comprobaciones superadas, sin errores de JavaScript.
```

La prueba comprueba que no haya errores de consola ni excepciones de página. Durante esta pasada se detectó y corrigió un error real: `aiApi.chat` devolvía `{ data: ... }` y el componente intentaba `response.text.split(...)`, lo que rompía la página al enviar el primer mensaje. Tras usar `result.data`, el chat quedó estable. Anteriormente la misma suite se ejecutó contra el artefacto de producción servido por `npm start` con 10/10 comprobaciones; la pasada final cubre además el copiloto y la descarga PDF.

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

## 9. Copiloto conversacional y OpenRouter gratuito

- `GET /api/ia/status` sin clave devolvió `{"externalModelAvailable":false,"mode":"local","model":null}`, sin exponer secretos. La interfaz etiqueta el modo como **Análisis local**.
- `POST /api/ia/chat` respondió con cifras del motor determinista (ejemplo real: inversión estimada `$ 1.443.200`), tabla pequeña de compras sugeridas, historial y opción **Nueva conversación**.
- La petición al proveedor, simulada con `global.fetch` en `tests/ai-chat.test.js`, usa `model: "openrouter/free"`, **no** envía array `models` de respaldo, fija `provider.max_price: {prompt: 0, completion: 0}`, `max_tokens: 512`, timeout de 12 s y un contexto agregado máximo de 3500 caracteres.
- Sin `consent: true` no se contacta al proveedor. Con 402, 429 o timeout se aplica exactamente: `El asistente conversacional no está disponible por el momento. Puedes seguir consultando las recomendaciones automáticas de STOCKALERT.` Un modelo de pago con `usage.cost: 0` también se rechaza; solo se acepta `openrouter/free`/`:free` con costo 0. El texto devuelto sanitiza posibles claves.
- El chat rechaza intenciones de modificar el inventario y remite al módulo Movimientos; no expone SQL ni ejecuta escrituras.
- Búsqueda en `frontend/`: 0 coincidencias de `sk-or-v1-`, `OPENROUTER_API_KEY` ni variables `VITE_` con secretos. El `.env` local mantiene `OPENROUTER_API_KEY=` vacía. **La clave compartida en la conversación debe rotarse** y configurarse solo en el backend/Vercel.

## 10. Configuración de Vercel Services verificada localmente

- `vercel.json` es JSON válido y usa el formato `services` con `backend` y `frontend`, sin comandos globales de build.
- Cada servicio declara su propio `installCommand` y `buildCommand`: `backend` ejecuta las migraciones pendientes una vez por despliegue; `frontend` compila la SPA en `dist`.
- Los rewrites raíz envían `/api`, `/api/*` y `/health` al servicio `backend` y el resto al servicio `frontend`. El fallback a `/index.html` está dentro del servicio frontend.
- No hay `bindings`: el navegador llama a `/api` en el mismo dominio.
- `backend/api/index.js` exporta la app Express; al importarla con `VERCEL=1` y variables de entorno de prueba no se llama a `listen()` y el proceso termina.
- Validación en checkout limpio: `npm install --dry-run` desde `backend/` resolvería 331 paquetes y desde `frontend/` 320, usando el workspace raíz del repositorio.
- `npm run build --workspace=frontend` compila la SPA correctamente (2107 módulos, 7,76 s en la última pasada).
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

- No se ejecutaron migraciones ni seed en la Neon configurada por el usuario. Esa base no tiene los usuarios demo, por lo que `tests/api.test.js` falla allí con 401 en `beforeAll`; la suite completa se verificó contra el fixture local `127.0.0.1:55432`.
- No se dispuso de cuenta/acceso a Vercel: **no se realizó un despliegue real**. Solo se verificó la configuración y el artefacto local. La clave de OpenRouter debe configurarse como `OPENROUTER_API_KEY` en el entorno del backend de Vercel; nunca como variable `VITE_`.
- La clave `sk-or-v1-…` aparecida en la conversación no se guardó ni se repitió. Debe considerarse comprometida y **rotarse** antes de configurarla en Vercel.
- Sin clave, el copiloto funciona en modo local y no envía datos a proveedores externos. No se activó facturación ni se usó ningún modelo de pago.
- Los datos demo existentes se conservaron; no se borró ninguna base de datos. No se ejecutaron seed, migraciones, DDL, `DELETE`, `UPDATE` ni SQL directo para esta tarea.

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

# En otra terminal, contra el modo desarrollo (PowerShell)
$env:E2E_BASE_URL='http://127.0.0.1:5173'
$envMap=@{}; Get-Content '.env' | ForEach-Object {
  if ($_ -match '^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$') { $envMap[$matches[1]]=$matches[2] }
}
$env:E2E_EMAIL=$envMap['SEED_ADMIN_EMAIL']
$env:E2E_PASSWORD=$envMap['SEED_ADMIN_PASSWORD']
npm run test:e2e --workspace=frontend
npm run test:fields
npm run test:numeric-e2e --workspace=frontend
npm run test:movements-e2e --workspace=frontend

# Artefacto de un solo puerto
npm start
$env:E2E_BASE_URL='http://localhost:4000'
npm run test:e2e --workspace=frontend
```

Para ejecutar la suite completa contra Neon, basta con que `DATABASE_URL` y `JWT_SECRET` estén en el `.env` raíz o en el entorno; las integraciones se activan automáticamente. Para aplicar migraciones de forma explícita: `npm run migrate`.

Variables nuevas del copiloto: `OPENROUTER_API_KEY` (solo servidor; vacía = modo local), `OPENROUTER_MODEL=openrouter/free`, `OPENROUTER_TIMEOUT_MS=12000` y `OPENROUTER_MAX_TOKENS=512`. En Vercel deben ir en la sección de variables de entorno del servicio **backend**; el frontend no necesita ninguna.
