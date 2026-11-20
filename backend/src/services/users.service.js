'use strict';

const bcrypt = require('bcryptjs');
const usersRepository = require('../repositories/users.repository');
const ApiError = require('../utils/ApiError');
const { publicUser } = require('./auth.service');

async function list(filters) {
  const result = await usersRepository.findAll(filters);
  return { rows: result.rows.map(publicUser), total: result.total };
}

async function get(id) {
  const user = await usersRepository.findById(id);
  if (!user) throw ApiError.notFound('Usuario no encontrado');
  return publicUser(user);
}

async function create(data) {
  const existing = await usersRepository.findByEmail(data.email);
  if (existing) throw ApiError.conflict('Ya existe un usuario con ese correo', 'DUPLICATE_EMAIL');
  const user = await usersRepository.create({
    ...data,
    email: data.email.toLowerCase(),
    passwordHash: await bcrypt.hash(data.password, 12),
  });
  return get(user.id);
}

async function update(id, fields) {
  await get(id);
  if (fields.email) {
    const other = await usersRepository.findByEmail(fields.email);
    if (other && Number(other.id) !== Number(id)) {
      throw ApiError.conflict('Ya existe un usuario con ese correo', 'DUPLICATE_EMAIL');
    }
  }
  return usersRepository.update(id, fields);
}

async function setActive(id, active) {
  await get(id);
  return usersRepository.update(id, { active });
}

async function resetPassword(id, password) {
  await get(id);
  await usersRepository.setPassword(id, await bcrypt.hash(password, 12));
}

module.exports = { list, get, create, update, setActive, resetPassword };
