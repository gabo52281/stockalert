'use strict';

/**
 * Matriz de permisos. Se valida SIEMPRE en backend; el frontend solo oculta controles.
 * Formato: modulo:accion
 */

const ALL = ['*'];

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

const PERMISSIONS = {
  ADMINISTRADOR: ALL,
  ENCARGADO_INVENTARIO: INVENTORY_MANAGER,
  CONSULTA: READ_ONLY,
};

const ROLE_LABELS = {
  ADMINISTRADOR: 'Administrador',
  ENCARGADO_INVENTARIO: 'Encargado de inventario',
  CONSULTA: 'Consulta',
};

function permissionsFor(role) {
  return PERMISSIONS[role] || [];
}

function can(role, permission) {
  const list = permissionsFor(role);
  return list.includes('*') || list.includes(permission);
}

module.exports = { PERMISSIONS, ROLE_LABELS, permissionsFor, can };
