'use strict';

const bcrypt = require('bcryptjs');
const usersRepository = require('../repositories/users.repository');
const { signToken } = require('../middlewares/auth');
const { ROLE_LABELS, permissionsFor, isSuperAdmin } = require('../config/permissions');
const { query, runAsSystem } = require('../config/database');
const ApiError = require('../utils/ApiError');

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role] || user.role,
    active: user.active,
    establishmentId: user.establishment_id ?? null,
    mustChangePassword: Boolean(user.must_change_password),
  };
}

async function login(email, password) {
  const user = await runAsSystem(() => usersRepository.findByEmail(email));
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw ApiError.unauthorized('Correo o contraseña incorrectos');
  }
  if (!user.active) {
    throw ApiError.unauthorized('El usuario está desactivado. Contacte al administrador.');
  }
  if (!isSuperAdmin(user.role)) {
    const establishment = await runAsSystem(() => query(
      'SELECT active FROM establishments WHERE id = $1',
      [user.establishment_id ?? -1],
    ));
    if (!establishment.rows[0]?.active) {
      throw ApiError.unauthorized('El establecimiento está desactivado. Contacte al superadministrador.');
    }
  }

  const { token } = signToken(user);
  return {
    user: publicUser(user),
    token,
    tokenType: 'Bearer',
    permissions: permissionsFor(user.role),
  };
}

async function logout(tokenInfo, userId) {
  if (tokenInfo?.jti && tokenInfo?.expiresAt) {
    await usersRepository.revokeToken(tokenInfo.jti, userId, tokenInfo.expiresAt);
  }
}

async function changePassword(userId, currentPassword, newPassword) {
  const full = await usersRepository.findByEmailForAuth(userId);
  if (!full || !(await bcrypt.compare(currentPassword, full.password_hash))) {
    throw ApiError.badRequest('La contraseña actual no es correcta', undefined);
  }
  await usersRepository.setPassword(userId, await bcrypt.hash(newPassword, 12), {
    mustChangePassword: false,
  });
}

async function me(user) {
  return publicUser(user);
}

module.exports = { login, logout, changePassword, me, publicUser };
