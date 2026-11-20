# Alcance del proyecto

STOCKALERT es un sistema de **control de inventarios para un solo establecimiento** con alertas preventivas. Su objetivo es registrar entradas y salidas, mantener existencias confiables y avisar cuando un producto se acerca a su nivel mínimo.

## 1. Incluido

- Gestión de productos, categorías y proveedores.
- Registro de movimientos de entrada y salida con trazabilidad (stock anterior/resultante, usuario, fecha, motivo).
- Cálculo automático de estados de alerta (`NORMAL`, `BAJO`, `CRITICO`, `AGOTADO`).
- Cálculo de cobertura a partir de salidas reales y ventanas configurables.
- Panel principal con gráficas e indicadores.
- Módulo de alertas, indicadores y reportes con exportación CSV/PDF.
- Autenticación con JWT, logout real con revocación y autorización por tres roles.
- Usuarios, perfiles y cambio de contraseña.
- Base de datos con migraciones versionadas, restricciones, índices, transacciones y datos demo claramente etiquetados.
- Pruebas automatizadas de backend y verificación E2E en navegador.
- Asistente IA **local y explicable**: estimación de demanda, stock de seguridad, punto de pedido, riesgo y detección de anomalías a partir de movimientos reales.

## 2. Excluido explícitamente

Según la formulación del proyecto, quedan fuera de alcance:

- Facturación y emisión de comprobantes de venta.
- Integraciones contables o con sistemas de Accounting/ERP.
- Pasarelas de pago o manejo de transacciones financieras.
- Aplicación móvil nativa (iOS/Android); la interfaz es web responsive.
- Predicción probabilística avanzada con modelos externos (OpenAI, Gemini, servicios de ML) o envío de datos a terceros.
- Generación automática de órdenes de compra; las decisiones de reposición las toma el usuario.
- Multi-sede, multi-almacén o logística entre sedes.
- Recuperación de contraseña por correo, SSO o doble factor.

La cobertura oficial es determinista (`stock ÷ promedio de salidas diarias`) y sigue siendo la fuente operativa. El asistente IA agrega una estimación complementaria, sin reemplazar las alertas ni decidir compras automáticamente.

**Nota:** los documentos académicos originales excluían la predicción avanzada con IA. Por decisión posterior del usuario se incorpora el módulo IA local descrito arriba, manteniendo fuera los modelos externos y la generación automática de pedidos.

## 3. Supuestos

- Un solo almacén y una sola moneda.
- Las cantidades pueden tener tres decimales (por ejemplo, productos vendidos por peso).
- El porcentaje preventivo por defecto es 25 %, la ventana de análisis 30 días y el historial mínimo 7 días; todos son configurables globalmente y por producto.
- Un producto inactivo no acepta nuevos movimientos.
- Los movimientos históricos no se editan; las correcciones se hacen con movimientos compensatorios.

## 4. Trazabilidad con los documentos académicos

La arquitectura y las reglas implementadas corresponden a lo planteado en:

- `ACTIVIDAD 1 FORMULACION DE PROYECTO DE GRADO.pdf`
- `AVANCE 2 PROYECTO DE GRADO.pdf`

De ellos se toman el nombre STOCKALERT, la stack React/Node/Express/PostgreSQL, los cuatro estados de inventario, la fórmula de cobertura y las exclusiones anteriores. La inclusión del asistente IA local es una extensión acordada después de esos documentos.
