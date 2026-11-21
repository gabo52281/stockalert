'use strict';

/**
 * Filtro SQL explícito de establecimiento. RLS sigue siendo la barrera en la
 * base de datos, pero el rol de conexión puede ser dueño de la tabla (como en
 * Neon), por lo que todas las consultas de inventario llevan también este
 * predicado derivado del GUC validado en authenticate().
 *
 * SYSTEM es el único contexto privilegiado de mantenimiento. Un token de
 * SUPERADMINISTRADOR no tiene GUC de establecimiento y, por diseño, no puede
 * consultar inventario de ninguna empresa.
 */
function tenantPredicate(alias = '') {
  const column = alias ? `${alias}.establishment_id` : 'establishment_id';
  return `(fn_app_is_system() OR ${column} = fn_app_establishment_id())`;
}

module.exports = { tenantPredicate };
