'use strict';

/**
 * Matriz de permisos. Se valida SIEMPRE en backend; el frontend solo oculta controles.
 * Formato: modulo:accion. Los permisosEstablishment son globales y no dan acceso
 * al inventario privado de los negocios.
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

const PERMISSIONS = {
  SUPERADMINISTRADOR: SUPER_ADMIN,
  ADMINISTRADOR: INVENTORY_MANAGER,
  ENCARGADO_INVENTARIO: INVENTORY_MANAGER,
  CONSULTA: READ_ONLY,
};

const ROLE_LABELS = {
  SUPERADMINISTRADOR: 'Superadministrador',
  ADMINISTRADOR: 'Administrador',
  ENCARGADO_INVENTARIO: 'Encargado de inventario',
  CONSULTA: 'Consulta',
};

const GLOBAL_ROLES = ['SUPERADMINISTRADOR'];

function permissionsFor(role) {
  return PERMISSIONS[role] || [];
}

function can(role, permission) {
  const list = permissionsFor(role);
  return list.includes('*') || list.includes(permission);
}

function isSuperAdmin(role) {
  return GLOBAL_ROLES.includes(role);
}

module.exports = {
  PERMISSIONS, ROLE_LABELS, GLOBAL_ROLES, permissionsFor, can, isSuperAdmin,
};
