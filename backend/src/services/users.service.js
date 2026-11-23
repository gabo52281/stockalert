'use strict';

const bcrypt = require('bcryptjs');
const usersRepository = require('../repositories/users.repository');
const ApiError = require('../utils/ApiError');
const { publicUser } = require('./auth.service');
const { isSuperAdmin } = require('../config/permissions');
const requireSuperAdmin = require('../utils/requireSuperAdmin');

function assertManageable(user) {
  if (isSuperAdmin(user?.role)) {
    throw ApiError.forbidden('La cuenta superadministrador no puede ser modificada desde el panel');
  }
}

async function list(filters, actor) {
  requireSuperAdmin(actor);
  const result = await usersRepository.findAll(filters);
  return { rows: result.rows.map(publicUser), total: result.total };
}

async function options(actor) {
  if (isSuperAdmin(actor?.role)) return [];
  if (actor?.establishment_id == null) {
    throw ApiError.forbidden('El usuario no tiene un establecimiento asignado');
  }
  return usersRepository.findTenantOptions();
}

async function get(id, actor) {
  requireSuperAdmin(actor);
  const user = await usersRepository.findById(id);
  if (!user) throw ApiError.notFound('Usuario no encontrado');
  return publicUser(user);
}

async function create(data, actor) {
  requireSuperAdmin(actor);
  if (isSuperAdmin(data.role)) {
    throw ApiError.forbidden('No se pueden crear superadministradores desde el panel');
  }
  if (!data.establishmentId) {
    throw ApiError.badRequest('Debe asignar un establecimiento al usuario');
  }
  const existing = await usersRepository.findByEmail(data.email);
  if (existing) throw ApiError.conflict('Ya existe un usuario con ese correo', 'DUPLICATE_EMAIL');
  const user = await usersRepository.create({
    ...data,
    email: data.email.toLowerCase(),
    passwordHash: await bcrypt.hash(data.password, 12),
  });
  return get(user.id, actor);
}

async function update(id, fields, actor) {
  requireSuperAdmin(actor);
  const target = await get(id, actor);
  assertManageable(target);
  if (isSuperAdmin(fields.role)) {
    throw ApiError.forbidden('No se pueden asignar privilegios de superadministrador desde el panel');
  }
  if (fields.establishmentId === null || fields.establishmentId === '') {
    throw ApiError.badRequest('Todo usuario debe pertenecer a un establecimiento');
  }
  if (fields.email) {
    const other = await usersRepository.findByEmail(fields.email);
    if (other && Number(other.id) !== Number(id)) {
      throw ApiError.conflict('Ya existe un usuario con ese correo', 'DUPLICATE_EMAIL');
    }
  }
  return usersRepository.update(id, fields);
}

async function setActive(id, active, actor) {
  requireSuperAdmin(actor);
  const target = await get(id, actor);
  assertManageable(target);
  return usersRepository.update(id, { active });
}

async function resetPassword(id, password, actor) {
  requireSuperAdmin(actor);
  const target = await get(id, actor);
  assertManageable(target);
  await usersRepository.setPassword(id, await bcrypt.hash(password, 12), {
    mustChangePassword: true,
  });
}

module.exports = {
  list, options, get, create, update, setActive, resetPassword,
};
