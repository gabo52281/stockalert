'use strict';

const bcrypt = require('bcryptjs');
const usersRepository = require('../repositories/users.repository');
const { signToken } = require('../middlewares/auth');
const { ROLE_LABELS } = require('../config/permissions');
const ApiError = require('../utils/ApiError');

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role] || user.role,
    active: user.active,
  };
}

async function login(email, password) {
  const user = await usersRepository.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw ApiError.unauthorized('Correo o contraseña incorrectos');
  }
  if (!user.active) {
    throw ApiError.unauthorized('El usuario está desactivado. Contacte al administrador.');
  }

  const { token } = signToken(user);
  return {
    user: publicUser(user),
    token,
    tokenType: 'Bearer',
    permissions: user.role === 'ADMINISTRADOR' ? ['*'] : undefined,
  };
}

async function logout(tokenInfo, userId) {
  if (tokenInfo?.jti && tokenInfo?.expiresAt) {
    await usersRepository.revokeToken(tokenInfo.jti, userId, tokenInfo.expiresAt);
  }
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await usersRepository.findById(userId);
  const full = await usersRepository.findByEmail(user.email);
  if (!(await bcrypt.compare(currentPassword, full.password_hash))) {
    throw ApiError.badRequest('La contraseña actual no es correcta', undefined);
  }
  await usersRepository.setPassword(userId, await bcrypt.hash(newPassword, 12));
}

async function me(user) {
  return publicUser(user);
}

module.exports = { login, logout, changePassword, me, publicUser };
