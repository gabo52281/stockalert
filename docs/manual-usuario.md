# Manual de usuario

## 1. Acceso

Abra `http://localhost:5173` e ingrese con su correo y contraseña. El sistema valida la sesión contra la API; si el token vence o fue revocado, lo devuelve al login.

Usuarios demo (solo en entornos de demostración):

| Correo | Rol | Qué puede hacer |
| --- | --- | --- |
| `admin@stockalert.local` | Administrador | Todo, incluida la gestión de usuarios |
| `encargado@stockalert.local` | Encargado de inventario | Catálogos, movimientos, alertas, indicadores y reportes |
| `consulta@stockalert.local` | Consulta | Solo lectura y exportación |
| `inactivo@stockalert.local` | — | No puede ingresar |

Contraseña demo: `Demo1234!`.

En un entorno real no se cargan estos usuarios: el administrador se crea con `npm run admin` usando `SEED_ADMIN_*` del `.env` raíz.

## 2. Panel principal

Muestra cuatro tarjetas (referencias activas, unidades disponibles, productos en atención y valor del inventario), gráficas de entradas/salidas y distribución de estados, movimientos recientes y una lista de productos que requieren atención. El selector de 7/30/90 días cambia el período de las series.

## 3. Productos

- **Nuevo producto:** código único, nombre, descripción, categoría, proveedor, precios, stock mínimo y porcentaje preventivo. Se crea con existencia **0**; el stock se asigna con una entrada.
- **Editar:** modifica datos del catálogo. No cambia existencias directamente.
- **Configurar alertas:** ajusta porcentaje preventivo, ventana de análisis y días mínimos de historial para ese producto.
- **Historial:** consulta todos sus movimientos con fechas, cantidades, stock anterior/resultante y usuario.
- **Activar/desactivar / eliminar:** acciones disponibles según el rol. Un producto inactivo no admite nuevos movimientos.

Filtros: búsqueda por nombre o código, categoría, estado de alerta y estado activo/inactivo.

## 4. Categorías y proveedores

Permiten crear, editar, desactivar y eliminar catálogos auxiliares. La eliminación se rechaza si existen dependencias que romperían la integridad del historial. En proveedores se puede consultar el listado de productos asociados.

## 5. Movimientos

- **Entrada (IN):** seleccione producto, cantidad, proveedor (opcional), fecha y notas. Aumenta la existencia.
- **Salida (OUT):** seleccione producto, cantidad, **motivo obligatorio**, fecha y notas. Disminuye la existencia. Si la cantidad supera el stock, la API responde `409 INSUFFICIENT_STOCK` y no se registra nada.

Cada movimiento queda registrado con stock anterior y resultante, usuario que lo ejecuta y timestamp. No se pueden editar ni borrar movimientos: para corregir un error, registre un movimiento compensatorio.

Filtros por tipo, producto, usuario y rango de fechas.

## 6. Alertas

Muestra la lista de productos que requieren atención, ordenada por severidad, con:

| Estado | Significado |
| --- | --- |
| **Agotado** | Stock = 0 |
| **Crítico** | Stock > 0 y ≤ mínimo |
| **Bajo** | Stock > mínimo y ≤ umbral preventivo |
| **Normal** | Por encima del umbral |

El umbral preventivo es `mínimo × (1 + porcentaje / 100)`. Con mínimo 0 y stock positivo, el estado es Normal.

El resumen muestra cuántos productos hay en cada estado. Al abrir el detalle de un producto se ven su cobertura, promedio de salidas y configuración efectiva.

## 7. Indicadores

Calcula, sobre una ventana de días configurable:

- Promedio de salidas diarias = unidades salidas en la ventana ÷ días de la ventana.
- Cobertura = stock actual ÷ promedio de salidas diarias.
- Valor del inventario al precio de compra y al precio de venta.

Si no hay salidas, se muestra **No calculable**; si el historial es más corto que los días mínimos configurados, se muestra **Sin datos suficientes**. No se inventan valores.

La tabla de cobertura se ordena por menor cobertura para priorizar decisiones.

## 8. Asistente IA

Disponible en el menú **Asistente IA** (`/ia`) para roles con permiso `indicators:read`.

1. Elija la ventana de análisis (7, 30 o 90 días) y el tiempo de reposición (7, 14, 21 o 30 días).
2. Revise las tarjetas: productos analizados, riesgo alto/crítico, unidades a reponer e inversión estimada.
3. Lea el resumen y la tabla **Plan de reposición sugerido**: muestra demanda diaria estimada, cobertura, punto de pedido, cantidad sugerida, riesgo y confianza.
4. Consulte **Anomalías detectadas** para identificar picos de salida atípicos.

El cálculo es local y explicable: usa sus propios movimientos, no envía datos a servicios externos y no sustituye las alertas oficiales de stock mínimo. La recomendación es una sugerencia; las decisiones de compra las toma el usuario.

## 9. Reportes

1. Seleccione el tipo de reporte (inventario, stock bajo, críticos, entradas, salidas, movimientos por rango/usuario, mayores salidas, cobertura o valoración).
2. Aplique filtros de fechas, producto, categoría, usuario o tipo de movimiento.
3. Use **Aplicar filtros** para actualizar la vista previa.
4. Descargue **CSV** o **PDF** con los mismos filtros.

Los archivos se generan en el backend con datos reales. El CSV incluye BOM para abrirse correctamente en Excel.

## 10. Usuarios y perfil

El administrador puede crear usuarios, asignar uno de los tres roles, activar/desactivar cuentas y restablecer contraseñas. Cualquier usuario puede cambiar su propia contraseña desde **Perfil**.

## 11. Cierre de sesión

El botón de usuario → **Cerrar sesión** revoca el token en el servidor. Cerrar la pestaña sin hacer logout deja el token en el navegador hasta que venza.
