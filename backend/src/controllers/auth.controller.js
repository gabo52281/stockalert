'use strict';

const service = require('../services/auth.service');
const { ok } = require('../utils/pagination');
const { permissionsFor } = require('../config/permissions');

async function login(req, res) {
  const { email, password } = req.validated.body;
  return ok(res, await service.login(email, password));
}

async function logout(req, res) {
  await service.logout(req.token, req.user.id);
  return ok(res, { message: 'Sesión cerrada correctamente' });
}

async function me(req, res) {
  const user = await service.me(req.user);
  // req.user.permissions lo llena authenticate; el respaldo evita respuestas
  // sin permisos si el middleware cambia en el futuro.
  return ok(res, {
    ...user,
    permissions: req.user.permissions || permissionsFor(req.user.role),
  });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validated.body;
  await service.changePassword(req.user.id, currentPassword, newPassword);
  return ok(res, { message: 'Contraseña actualizada' });
}

module.exports = { login, logout, me, changePassword };
