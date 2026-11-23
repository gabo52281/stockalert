# Alcance del proyecto

STOCKALERT es un sistema **multiempresa** de control de inventarios con alertas preventivas: un `SUPERADMINISTRADOR` global administra establecimientos aislados, cada uno con sus propios usuarios y datos, desde el panel `/superadmin`. Su objetivo es registrar entradas y salidas, mantener existencias confiables y avisar cuando un producto se acerca a su nivel mínimo.

## 1. Incluido

- Arquitectura multiempresa: establecimientos aislados, usuarios por establecimiento y panel de administración general `/superadmin`. El `establishment_id` se deriva del JWT validado en backend y se ignora cualquier `tenant_id` del frontend; RLS/FORCE RLS con GUCs y predicados SQL explícitos refuerzan el aislamiento.
- Cuatro roles: `SUPERADMINISTRADOR` (establecimientos, cuentas y estadísticas globales; sin inventario ni IA), `ADMINISTRADOR` y `ENCARGADO_INVENTARIO` (inventario completo en su establecimiento; sin gestión de cuentas) y `CONSULTA` (solo lectura en su establecimiento).
- Gestión de productos, categorías y proveedores.
- Registro de movimientos de entrada y salida con trazabilidad (stock anterior/resultante, usuario, fecha, motivo).
- Cálculo automático de estados de alerta (`NORMAL`, `BAJO`, `CRITICO`, `AGOTADO`).
- Cálculo de cobertura a partir de salidas reales y ventanas configurables.
- Panel principal con gráficas e indicadores.
- Módulo de alertas, indicadores y 10 reportes con exportación JSON/CSV/PDF, aislados por establecimiento.
- Autenticación con JWT, logout real con revocación y autorización por cuatro roles; login profesional sin cartel demo ni registro público.
- Usuarios, perfiles y cambio de contraseña obligatorio en el primer login.
- Base de datos con migraciones versionadas (incluidas `005_multi_tenant.sql` a `008_harden_tenant_boundaries.sql`), restricciones, índices y transacciones. No se cargan datos demo: el seed está deshabilitado y el SQL antiguo se conserva solo como referencia histórica.
- Pruebas automatizadas de backend y verificación E2E en navegador con credenciales de una fixture local definidas en variables `TEST_*`/`E2E_*`.
- Asistente IA con cálculo **local y explicable** (estimación de demanda, stock de seguridad, punto de pedido, riesgo y detección de anomalías a partir de movimientos reales) y chat conversacional con OpenAI que responde con un resumen agregado del establecimiento.

## 2. Excluido explícitamente

Según la formulación del proyecto, quedan fuera de alcance:

- Facturación y emisión de comprobantes de venta.
- Integraciones contables o con sistemas de Accounting/ERP.
- Pasarelas de pago o manejo de transacciones financieras.
- Aplicación móvil nativa (iOS/Android); la interfaz es web responsive.
- Predicción probabilística avanzada externa y generación automática de decisiones. El chat sí envía un resumen agregado del establecimiento a OpenAI, sin consentimiento previo.
- Generación automática de órdenes de compra; las decisiones de reposición las toma el usuario.
- Logística o transferencias de stock entre establecimientos: cada establecimiento es un tenant aislado.
- Registro público, credenciales demo y recuperación de contraseña por correo, SSO o doble factor.

La cobertura oficial es determinista (`stock ÷ promedio de salidas diarias`) y sigue siendo la fuente operativa. El asistente IA agrega una estimación complementaria, sin reemplazar las alertas ni decidir compras automáticamente.

**Nota:** los documentos académicos originales excluían la predicción avanzada con IA. Por decisión posterior del usuario se incorpora el módulo IA descrito arriba: el cálculo sigue siendo local y la conversación la genera OpenAI. La generación automática de pedidos sigue fuera.

## 3. Supuestos

- Un almacén por establecimiento y una sola moneda; cada establecimiento es un tenant aislado con sus propios usuarios y datos.
- Las cantidades pueden tener tres decimales (por ejemplo, productos vendidos por peso).
- El porcentaje preventivo por defecto es 25 %, la ventana de análisis 30 días y el historial mínimo 7 días; todos son configurables globalmente y por producto.
- Un producto inactivo no acepta nuevos movimientos.
- Los movimientos históricos no se editan; las correcciones se hacen con movimientos compensatorios.

## 4. Trazabilidad con los documentos académicos

La arquitectura y las reglas implementadas corresponden a lo planteado en:

- `ACTIVIDAD 1 FORMULACION DE PROYECTO DE GRADO.pdf`
- `AVANCE 2 PROYECTO DE GRADO.pdf`

De ellos se toman el nombre STOCKALERT, la stack React/Node/Express/PostgreSQL, los cuatro estados de inventario, la fórmula de cobertura y las exclusiones anteriores. La inclusión del asistente IA y de la arquitectura multiempresa son extensiones acordadas después de esos documentos.
