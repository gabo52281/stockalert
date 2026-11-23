/**
 * Espejo de la matriz de permisos de backend/src/config/permissions.js.
 * El backend sigue siendo la autoridad: esta lista solo se usa como respaldo
 * cuando /auth/me no devuelve `permissions` (por ejemplo, con un backend
 * desplegado antes de la arquitectura multiempresa). Nunca habilita módulos
 * nuevos: solo evita que un rol válido quede sin menú por una respuesta vieja.
 */

const INVENTORY_MANAGER = [
  'products:read', 'products:create', 'products:update', 'products:deactivate', 'products:delete',
  'categories:read', 'categories:create', 'categories:update', 'categories:deactivate', 'categories:delete',
  'suppliers:read', 'suppliers:create', 'suppliers:update', 'suppliers:deactivate', 'suppliers:delete',
  'movements:read', 'movements:create',
  'alerts:read', 'indicators:read', 'dashboard:read',
  'reports:read', 'reports:export',
  'profile:read', 'profile:update',
];

const READ_ONLY = [
  'products:read', 'categories:read', 'suppliers:read', 'movements:read',
  'alerts:read', 'indicators:read', 'dashboard:read',
  'reports:read', 'reports:export',
  'profile:read', 'profile:update',
];

const SUPER_ADMIN = [
  'establishments:read', 'establishments:create', 'establishments:update', 'establishments:activate',
  'users:read', 'users:create', 'users:update', 'users:activate', 'users:reset-password',
  'admin-stats:read',
  'profile:read', 'profile:update',
];

export const PERMISSIONS = {
  SUPERADMINISTRADOR: SUPER_ADMIN,
  ADMINISTRADOR: INVENTORY_MANAGER,
  ENCARGADO_INVENTARIO: INVENTORY_MANAGER,
  CONSULTA: READ_ONLY,
};

export const ROLE_LABELS = {
  SUPERADMINISTRADOR: 'Superadministrador',
  ADMINISTRADOR: 'Administrador',
  ENCARGADO_INVENTARIO: 'Encargado de inventario',
  CONSULTA: 'Consulta',
};

/**
 * Devuelve los permisos recibidos del backend si son válidos; si no, aplica
 * la matriz local del rol. El inventario sigue vedado al superadministrador.
 */
export function permissionsFor(role, backendPermissions) {
  if (Array.isArray(backendPermissions) && backendPermissions.length > 0) {
    return backendPermissions;
  }
  return PERMISSIONS[role] ? [...PERMISSIONS[role]] : [];
}

export function can(role, backendPermissions, permission) {
  return permissionsFor(role, backendPermissions).includes(permission);
}
