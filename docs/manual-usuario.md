# Manual de usuario

## 1. Acceso

Abra `http://localhost:5173` e ingrese con el correo y la contraseña que le entregó su administrador. No hay cartel de demostración, usuarios demo ni registro público: `npm run seed` está deshabilitado y el sistema valida la sesión contra la API. Si el token vence o fue revocado, la aplicación lo devuelve al login.

En el **primer inicio de sesión** debe cambiar la contraseña desde **Perfil**: mientras `must_change_password` esté activo, la aplicación lo redirige a `/perfil`. Las contraseñas se guardan como hashes bcrypt y nunca se muestran. Si su cuenta se desactiva o su establecimiento se desactiva, no podrá ingresar.

Después del login, `/auth/me` hidrata los permisos de todos los roles y la aplicación abre la página inicial según el rol:

| Rol | Ruta inicial | Qué puede hacer |
| --- | --- | --- |
| `SUPERADMINISTRADOR` | `/superadmin` | Gestiona establecimientos y cuentas y consulta estadísticas globales. No tiene acceso a inventario ni a IA. |
| `ADMINISTRADOR` | `/` | Inventario completo dentro de su establecimiento. No gestiona cuentas. |
| `ENCARGADO_INVENTARIO` | `/movimientos` | Catálogos, movimientos, alertas, indicadores y reportes dentro de su establecimiento. No gestiona cuentas. |
| `CONSULTA` | `/` | Solo lectura y exportación dentro de su establecimiento. |

Todo lo que ve —productos, movimientos, alertas y reportes— pertenece a su establecimiento. El sistema toma el establecimiento del token validado en servidor, no de la página que esté visitando.

Si participa en pruebas, las credenciales se definen en variables de entorno de una fixture local (`TEST_*` para integración, `E2E_*` para navegador); no hay credenciales de prueba escritas en esta guía.

## 2. Panel de administración general (`/superadmin`)

Disponible solo para `SUPERADMINISTRADOR`. Desde aquí se crean y desactivan establecimientos, se asigna un administrador a cada uno y se gestionan las cuentas de todos ellos (alta, rol, activación y restablecimiento de contraseña). También se consultan estadísticas globales del sistema.

El superadministrador **no** ve inventario de ningún establecimiento ni usa el Asistente IA. La promoción a superadministrador no se hace desde la interfaz: es un paso manual y autorizado con `npm run promote:superadmin`, que no modifica la contraseña de la cuenta.

## 3. Panel principal

Muestra cuatro tarjetas (referencias activas, unidades disponibles, productos en atención y valor del inventario), gráficas de entradas/salidas y distribución de estados, movimientos recientes y una lista de productos que requieren atención. El selector de 7/30/90 días cambia el período de las series. Los datos corresponden únicamente a su establecimiento.

## 4. Productos

- **Nuevo producto:** código único, nombre, descripción, categoría, proveedor, precios, stock mínimo y porcentaje preventivo. Se crea con existencia **0**; el stock se asigna con una entrada.
- **Editar:** modifica datos del catálogo. No cambia existencias directamente.
- **Configurar alertas:** ajusta porcentaje preventivo, ventana de análisis y días mínimos de historial para ese producto.
- **Historial:** consulta todos sus movimientos con fechas, cantidades, stock anterior/resultante y usuario.
- **Activar/desactivar / eliminar:** acciones disponibles según el rol. Un producto inactivo no admite nuevos movimientos.

Filtros: búsqueda por nombre o código, categoría, estado de alerta y estado activo/inactivo.

## 5. Categorías y proveedores

Permiten crear, editar, desactivar y eliminar catálogos auxiliares. La eliminación se rechaza si existen dependencias que romperían la integridad del historial. En proveedores se puede consultar el listado de productos asociados.

## 6. Movimientos

- **Entrada (IN):** seleccione producto, cantidad, proveedor (opcional), fecha y notas. Aumenta la existencia.
- **Salida (OUT):** seleccione producto, cantidad, **motivo obligatorio**, fecha y notas. Disminuye la existencia. Si la cantidad supera el stock, la API responde `409 INSUFFICIENT_STOCK` y no se registra nada.

Cada movimiento queda registrado con stock anterior y resultante, usuario que lo ejecuta y timestamp. No se pueden editar ni borrar movimientos: para corregir un error, registre un movimiento compensatorio. El usuario y el producto deben pertenecer al mismo establecimiento.

Filtros por tipo, producto, usuario y rango de fechas.

## 7. Alertas

Muestra la lista de productos que requieren atención, ordenada por severidad, con:

| Estado | Significado |
| --- | --- |
| **Agotado** | Stock = 0 |
| **Crítico** | Stock > 0 y ≤ mínimo |
| **Bajo** | Stock > mínimo y ≤ umbral preventivo |
| **Normal** | Por encima del umbral |

El umbral preventivo es `mínimo × (1 + porcentaje / 100)`. Con mínimo 0 y stock positivo, el estado es Normal.

El resumen muestra cuántos productos hay en cada estado. Al abrir el detalle de un producto se ven su cobertura, promedio de salidas y configuración efectiva.

## 8. Indicadores

Calcula, sobre una ventana de días configurable:

- Promedio de salidas diarias = unidades salidas en la ventana ÷ días de la ventana.
- Cobertura = stock actual ÷ promedio de salidas diarias.
- Valor del inventario al precio de compra y al precio de venta.

Si no hay salidas, se muestra **No calculable**; si el historial es más corto que los días mínimos configurados, se muestra **Sin datos suficientes**. No se inventan valores.

La tabla de cobertura se ordena por menor cobertura para priorizar decisiones.

## 9. Asistente IA

Disponible en el menú **Asistente IA** (`/ia`) para roles con permiso `indicators:read`; el superadministrador no lo tiene.

1. Elija la ventana de análisis (7, 30 o 90 días) y el tiempo de reposición (7, 14, 21 o 30 días).
2. Revise las tarjetas: productos analizados, riesgo alto/crítico, unidades a reponer e inversión estimada.
3. Lea el resumen y la tabla **Plan de reposición sugerido**: muestra demanda diaria estimada, cobertura, punto de pedido, cantidad sugerida, riesgo y confianza.
4. Consulte **Anomalías detectadas** para identificar picos de salida atípicos.

El módulo del Asistente IA muestra únicamente el **chat**, con preguntas rápidas para empezar. El backend envía a OpenAI un resumen agregado de su establecimiento (cifras de productos y movimientos, sin datos personales) para redactar una respuesta en lenguaje natural, sin Markdown y sin inventar cifras. Puede preguntar libremente, por ejemplo «¿qué debo comprar esta semana?», «¿qué productos se van a agotar?» o «tengo $ 500.000, ¿qué me recomiendas?». Si no hay clave configurada o el servicio falla, verá el aviso **IA temporalmente fuera de servicio**. No hay respuestas locales de respaldo. La recomendación es una sugerencia; las decisiones de compra las toma el usuario.

## 10. Reportes

1. Seleccione el tipo de reporte (inventario, stock bajo, críticos, entradas, salidas, movimientos por rango/usuario, mayores salidas, cobertura o valoración).
2. Aplique filtros de fechas, producto, categoría, usuario o tipo de movimiento.
3. Use **Aplicar filtros** para actualizar la vista previa.
4. Descargue **CSV**, **PDF** o **JSON** con los mismos filtros.

Los 10 reportes se generan en el backend con datos reales de su establecimiento. El CSV incluye BOM para abrirse correctamente en Excel.

## 11. Usuarios y perfil

Desde `/superadmin`, el superadministrador trabaja en una única pantalla con tres pestañas: **Resumen**, **Establecimientos** y **Usuarios y permisos**.

En la pestaña **Usuarios y permisos** puede crear usuarios, asignarles obligatoriamente un establecimiento, elegir uno de los tres roles gestionables (`ADMINISTRADOR`, `ENCARGADO_INVENTARIO` o `CONSULTA`), activar/desactivar cuentas y restablecer contraseñas. Los usuarios se muestran agrupados por establecimiento; el interruptor permite volver a una lista paginada con filtros por rol, estado y comercio.

La cuenta `SUPERADMINISTRADOR` aparece sola en el grupo “Sin establecimiento” y no se puede editar, desactivar ni restablecer desde el panel. Los roles `ADMINISTRADOR` y `ENCARGADO_INVENTARIO` **no** gestionan cuentas de otros usuarios.

La antigua ruta `/usuarios` redirige automáticamente a `/superadmin?tab=usuarios` para no romper enlaces guardados.

Cualquier usuario puede cambiar su propia contraseña desde **Perfil**; hacerlo obliga a iniciar sesión de nuevo porque se invalida la versión de la contraseña. Los hashes nunca se muestran.

## 12. Cierre de sesión

El botón de usuario → **Cerrar sesión** revoca el token en el servidor. Cerrar la pestaña sin hacer logout deja el token en el navegador hasta que venza.
