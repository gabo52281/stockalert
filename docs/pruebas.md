# Pruebas y verificación

Todos los resultados registrados aquí corresponden a comandos **ejecutados realmente** el 2026-11-20. No se ejecutaron migraciones en Neon ni despliegue en Vercel. La conexión a Neon solo se ejerció al ejecutar la suite con el `.env` configurado por el usuario, tal como se detalla en la sección 3.

## 1. Entorno usado

- Node.js 24.20.0 y npm.
- Proyecto configurado con un único `.env` en la raíz.
- Base de datos de verificación: PostgreSQL existente en `127.0.0.1:55432`, base `stockalert`, usado **solo como fixture temporal**. No es dependencia del proyecto y sus datos no se eliminaron.
- API Express en `http://localhost:4100` (puerto definido en el `.env` de verificación).
- Frontend en `http://localhost:5173` mediante `npm run dev`, y también servido por Express en modo producción local.
- Microsoft Edge headless mediante `playwright-core`.

## 2. Instalación

Comando: `npm install` en la raíz.

Resultado: 486 paquetes añadidos, 17 eliminados, 497 auditados. npm informó 9 vulnerabilidades en dependencias transitivas (5 moderadas, 2 altas, 2 críticas) y avisos de paquetes con scripts de instalación no cubiertos por `allowScripts`. No se aplicó `npm audit fix --force` porque cambia versiones de forma rompiente.

Se eliminaron los lockfiles anidados de `backend/` y `frontend/`; la raíz conserva el único `package-lock.json` de workspaces.

## 3. Backend — Vitest + Supertest

Comando: `npm test` en la raíz, con `.env` apuntando a la base de datos de verificación.

Resultado real tras la corrección numérica y monetaria:

```text
Test Files  6 passed (6)
Tests       53 passed (53)
Duration    3.30s
```

Cobertura:

| Archivo | Comprobaciones |
| --- | --- |
| `tests/api.test.js` (14) | `/health`; login inválido 401; ruta privada sin token 401; permiso de rol 403; validación Zod 400; creación de producto stock 0; entrada con stock anterior/resultante; salida con stock resultante; exceso de salida 409; historial conservado; resumen de alertas; dashboard e indicadores; **`/api/ia/insights` con datos reales**; JSON/CSV/PDF; logout con token revocado |
| `tests/ai.test.js` (7) | normalización de serie; sin historial; demanda constante y tendencia; detección de pico atípico; sugerencia de reposición y riesgo; sin reposición cuando hay cobertura; resumen priorizado |
| `tests/alerts.test.js` (6) | `AGOTADO`, `CRITICO`, `BAJO`, `NORMAL`, mínimo 0 y porcentaje por producto |
| `tests/metrics.test.js` (4) | promedio/cobertura, `INSUFICIENTE`, `NO_CALCULABLE`, valoración |
| `tests/validation.test.js` (19) | enteros y cadenas de dígitos aceptados; rechazo de decimales, negativos, notación científica, comas y vacío en precios, stock, porcentajes y días; cantidades > 0; formato COP de reportes sin decimales |
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

Tras la corrección numérica, `npm run test:unit` incluye `tests/validation.test.js` y totaliza **29/29 pruebas puras** (7 de IA, 19 de validación/formato y 3 de Neon), sin requerir base de datos.

**Verificación posterior con una Neon recién creada:** al ejecutar `npm test` con el `.env` apuntando a la Neon configurada por el usuario (sin datos demo), `tests/api.test.js` falla en `beforeAll` porque espera `admin@stockalert.local` / `Demo1234!`. Resultado real: 4 archivos OK, 1 fallido; 20 pruebas superadas, 14 omitidas. Los otros 4 archivos (`ai`, `alerts`, `metrics`, `neon`) pasan. No es una regresión del cambio de Vercel Services: la suite de API necesita una base con datos demo (o credenciales de prueba equivalentes). No se cargó el seed en esa base.

## 4. Lint

Comando: `npm run lint` en la raíz (backend y frontend).

Resultado: ESLint terminó sin errores ni advertencias.

Durante la verificación final se corrigieron dos regresiones detectadas por lint/E2E:

- `Button` dejó de propagar `fullWidth` como atributo DOM inválido y lo transforma en la clase `btn--block`.
- `vite.config.js` declara `process` como global para ESLint al leer `PORT` desde el entorno.

## 5. Build

Comando: `npm run build` en la raíz.

Resultado real tras la corrección numérica: compilación correcta de 2107 módulos en 8,20 s.

```text
index.html                  1.11 kB │ gzip:   0.60 kB
assets/index-*.css         27.92 kB │ gzip:   6.45 kB
assets/icons-*.js          25.34 kB │ gzip:   5.20 kB
assets/index-*.js         290.70 kB │ gzip:  58.06 kB
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
STOCKALERT API escuchando en http://localhost:4100
API listo en http://127.0.0.1:4100/health
STOCKALERT listo: http://localhost:5173
```

Durante la sesión se registraron respuestas `GET /api/ia/insights?days=30&leadTimeDays=14 → 200`. El proceso se terminó deliberadamente al finalizar la verificación.

## 7. E2E en navegador

Comando: `npm run test:e2e --workspace=frontend`, primero contra `npm run dev` y después contra el artefacto de producción servido por `npm start`.

Salida real (idéntica en ambos modos):

```text
1. Login renderizado correctamente
2. Autenticación y panel principal cargados
3. Indicadores y gráficas con datos reales: 10 | 286 | 7 | $ 868.600
4. Productos: 10 filas visibles
5. Módulo de alertas cargado con filas reales
6. Módulo de indicadores cargado con cobertura real
7. Asistente IA con análisis real cargado
8. Reportes con vista previa de 10 columnas
9. Logout y redirección verificados
10. Diseño responsive en 390 px verificado

E2E: 10 comprobaciones superadas, sin errores de JavaScript.
```

La prueba comprueba que no haya errores de consola ni excepciones de página. La pasada contra producción usó `NODE_ENV=production`, `CORS_ORIGIN=http://127.0.0.1:4100`, `E2E_BASE_URL=http://127.0.0.1:4100` y el `frontend/dist` generado por `npm run build`.

### E2E específico de campos numéricos

Comando: `npm run test:numeric-e2e --workspace=frontend`, con `E2E_BASE_URL=http://localhost:5180` contra un servidor de desarrollo apoyado en el fixture local.

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

## 8. Configuración de Vercel Services verificada localmente

- `vercel.json` es JSON válido y usa el formato `services` con `backend` y `frontend`, sin comandos globales de build.
- Cada servicio declara su propio `installCommand` y `buildCommand`: `backend` ejecuta las migraciones pendientes una vez por despliegue; `frontend` compila la SPA en `dist`.
- Los rewrites raíz envían `/api`, `/api/*` y `/health` al servicio `backend` y el resto al servicio `frontend`. El fallback a `/index.html` está dentro del servicio frontend.
- No hay `bindings`: el navegador llama a `/api` en el mismo dominio.
- `backend/api/index.js` exporta la app Express; al importarla con `VERCEL=1` y variables de entorno de prueba no se llama a `listen()` y el proceso termina.
- Validación en checkout limpio: `npm install --dry-run` desde `backend/` resolvería 331 paquetes y desde `frontend/` 320, usando el workspace raíz del repositorio.
- `npm run build --workspace=frontend` compila la SPA correctamente (2107 módulos, 8,20 s en la última pasada).
- En `app.js`, el sirvido estático de `frontend/dist` se desactiva cuando `VERCEL` está definido, porque la plataforma sirve los archivos.
- El bundle de frontend usa `baseURL: '/api'`; no aparece `VITE_API_URL` ni secretos en el código compilado.

Comprobación adicional: el endpoint IA devolvió un narrative real en la base de datos de verificación:

```text
Se analizaron 10 productos activos. 2 tienen riesgo alto o crítico y 5 necesitan reposición.
La inversión estimada para cubrir la demanda de 14 días es 236200.
```

## 9. Corrección global de campos numéricos y monetarios

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

## 10. Limitaciones

- No se ejecutaron migraciones ni seed en la Neon configurada por el usuario. Esa base no tiene los usuarios demo, por lo que `tests/api.test.js` falla allí con 401 en `beforeAll`; la suite completa se verificó contra el fixture local `127.0.0.1:55432`.
- No se dispuso de cuenta/acceso a Vercel: **no se realizó un despliegue real**. Solo se verificó la configuración y el artefacto local.
- Los datos demo existentes se conservaron; no se borró ninguna base de datos.

## 11. Repetir la verificación

```bash
# Configuración inicial
cp .env.example .env
# Editar DATABASE_URL (pooler de Neon) y JWT_SECRET

npm install
npm run lint
npm test
npm run build
npm run dev

# En otra terminal, contra el modo desarrollo
npm run test:e2e --workspace=frontend
npm run test:fields
npm run test:numeric-e2e

# Artefacto de un solo puerto
npm start
$env:E2E_BASE_URL='http://localhost:4000'
npm run test:e2e --workspace=frontend
```

Para ejecutar la suite completa contra Neon, basta con que `DATABASE_URL` y `JWT_SECRET` estén en el `.env` raíz o en el entorno; las integraciones se activan automáticamente. Para aplicar migraciones de forma explícita: `npm run migrate`.
