'use strict';

const bcrypt = require('bcryptjs');
const repository = require('../repositories/establishments.repository');
const usersRepository = require('../repositories/users.repository');
const { transaction, runAsSystem } = require('../config/database');
const ApiError = require('../utils/ApiError');
const requireSuperAdmin = require('../utils/requireSuperAdmin');

async function list(filters, actor) {
  requireSuperAdmin(actor);
  const result = await repository.findAll(filters);
  return { rows: result.rows, total: result.total };
}

async function get(id, actor) {
  requireSuperAdmin(actor);
  const establishment = await repository.findById(id);
  if (!establishment) throw ApiError.notFound('Establecimiento no encontrado');
  return establishment;
}

async function create(data, actor) {
  requireSuperAdmin(actor);
  return transaction((client) => repository.create(data, client)
    .then((created) => repository.createDefaultSettings(created.id, client).then(() => created)));
}

async function update(id, fields, actor) {
  requireSuperAdmin(actor);
  await get(id, actor);
  return repository.update(id, fields);
}

async function setActive(id, active, actor) {
  requireSuperAdmin(actor);
  await get(id, actor);
  return repository.setActive(id, active);
}

async function usersFor(id, actor) {
  requireSuperAdmin(actor);
  await get(id, actor);
  return repository.usersFor(id);
}

async function stats(actor) {
  requireSuperAdmin(actor);
  return repository.stats();
}

async function createWithAdmin(data, actor) {
  requireSuperAdmin(actor);
  const existing = await runAsSystem(() => usersRepository.findByEmail(data.admin.email));
  if (existing) throw ApiError.conflict('Ya existe un usuario con ese correo', 'DUPLICATE_EMAIL');

  return transaction(async (client) => {
    const establishment = await repository.create(data.establishment, client);
    await repository.createDefaultSettings(establishment.id, client);
    const admin = await repository.createAdminForEstablishment(
      establishment.id,
      data.admin,
      await bcrypt.hash(data.admin.password, 12),
      client,
    );
    return { establishment, admin };
  });
}

module.exports = {
  list, get, create, update, setActive, usersFor, stats, createWithAdmin,
};
