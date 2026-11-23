import assert from 'node:assert/strict';
import test from 'node:test';
import { can, permissionsFor } from '../src/config/permissions.js';

test('el superadmin conserva administración aunque /auth/me no devuelva permisos', () => {
  const permissions = permissionsFor('SUPERADMINISTRADOR', []);

  assert.ok(permissions.includes('users:read'));
  assert.ok(permissions.includes('establishments:read'));
  assert.ok(permissions.includes('admin-stats:read'));
  assert.ok(!permissions.includes('products:read'));
  assert.ok(!permissions.includes('dashboard:read'));
  assert.ok(!permissions.includes('movements:create'));
});

test('se respeta la lista de permisos enviada por el backend', () => {
  const backendPermissions = ['users:read', 'profile:read'];
  const permissions = permissionsFor('SUPERADMINISTRADOR', backendPermissions);

  assert.deepEqual(permissions, backendPermissions);
  assert.equal(can('SUPERADMINISTRADOR', backendPermissions, 'users:read'), true);
  assert.equal(can('SUPERADMINISTRADOR', backendPermissions, 'establishments:read'), false);
});

test('los roles de inventario conservan su acceso sin depender del backend', () => {
  const admin = permissionsFor('ADMINISTRADOR', []);
  const manager = permissionsFor('ENCARGADO_INVENTARIO', []);
  const readonly = permissionsFor('CONSULTA', []);

  assert.ok(admin.includes('products:create'));
  assert.ok(admin.includes('movements:create'));
  assert.deepEqual(admin, manager);

  assert.ok(readonly.includes('products:read'));
  assert.ok(readonly.includes('reports:export'));
  assert.ok(!readonly.includes('products:create'));
  assert.ok(!readonly.includes('movements:create'));
});

test('un rol desconocido no recibe permisos', () => {
  assert.deepEqual(permissionsFor('ROL_INEXISTENTE', undefined), []);
  assert.equal(can('ROL_INEXISTENTE', null, 'users:read'), false);
});
