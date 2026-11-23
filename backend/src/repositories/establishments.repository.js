'use strict';

const { query } = require('../config/database');

const COLUMNS = `
  id, name, tax_id, address, phone, email, active, created_at, updated_at
`;

function run(client, text, params) {
  return client ? client.query(text, params) : query(text, params);
}

async function findAll({ q, active, limit, offset }) {
  const where = [];
  const values = [];
  if (q) {
    values.push(`%${q}%`);
    where.push(`(name ILIKE $${values.length} OR COALESCE(tax_id, '') ILIKE $${values.length}
      OR COALESCE(email, '') ILIKE $${values.length})`);
  }
  if (active !== undefined && active !== null) {
    values.push(active);
    where.push(`active = $${values.length}`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows, count] = await Promise.all([
    query(
      `SELECT ${COLUMNS}, (SELECT count(*)::int FROM users u WHERE u.establishment_id = establishments.id) AS users_count
         FROM establishments ${clause} ORDER BY id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    query(`SELECT count(*)::int AS total FROM establishments ${clause}`, values),
  ]);
  return { rows: rows.rows, total: count.rows[0].total };
}

async function findById(id, client) {
  const { rows } = await run(
    client,
    `SELECT ${COLUMNS}, (SELECT count(*)::int FROM users u WHERE u.establishment_id = $1) AS users_count
       FROM establishments WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function create(data, client) {
  const { rows } = await run(
    client,
    `INSERT INTO establishments (name, tax_id, address, phone, email, active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [data.name, data.taxId || null, data.address || null, data.phone || null,
      data.email || null, data.active !== false],
  );
  return rows[0];
}

async function update(id, fields, client) {
  const map = {
    name: 'name', taxId: 'tax_id', address: 'address', phone: 'phone',
    email: 'email', active: 'active',
  };
  const sets = [];
  const values = [id];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || !map[key]) continue;
    values.push(value === '' ? null : value);
    sets.push(`${map[key]} = $${values.length}`);
  }
  if (!sets.length) return findById(id, client);
  await run(client, `UPDATE establishments SET ${sets.join(', ')} WHERE id = $1`, values);
  return findById(id, client);
}

async function setActive(id, active, client) {
  return update(id, { active }, client);
}

async function usersFor(id, client) {
  const { rows } = await run(
    client,
    `SELECT u.id, u.name, u.email, u.active, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.establishment_id = $1 ORDER BY u.id`,
    [id],
  );
  return rows;
}

async function stats(client) {
  const { rows } = await run(
    client,
    `SELECT
       (SELECT count(*)::int FROM establishments) AS total_establishments,
       (SELECT count(*)::int FROM establishments WHERE active) AS active_establishments,
       (SELECT count(*)::int FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'ADMINISTRADOR')) AS total_admins,
       (SELECT count(*)::int FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'ENCARGADO_INVENTARIO')) AS total_managers,
       (SELECT count(*)::int FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'CONSULTA')) AS total_readonly,
       (SELECT count(*)::int FROM users WHERE active) AS active_users,
       (SELECT count(*)::int FROM users WHERE NOT active) AS inactive_users`,
    [],
  );
  return rows[0];
}

async function createAdminForEstablishment(establishmentId, admin, passwordHash, client) {
  const { rows } = await run(
    client,
    `INSERT INTO users (name, email, password_hash, role_id, active, establishment_id)
     VALUES ($1, $2, $3, (SELECT id FROM roles WHERE name = 'ADMINISTRADOR'), TRUE, $4)
     RETURNING id, name, email, active, establishment_id`,
    [admin.name, admin.email.toLowerCase(), passwordHash, establishmentId],
  );
  return rows[0];
}

async function createDefaultSettings(establishmentId, client) {
  const defaults = [
    ['alert.preventive_percentage', '25', 'Porcentaje preventivo por defecto'],
    ['metrics.analysis_window_days', '30', 'Ventana de análisis en días'],
    ['metrics.min_history_days', '7', 'Historial mínimo en días'],
    ['system.name', '"STOCKALERT"', 'Nombre del sistema'],
  ];
  for (const [key, value, description] of defaults) {
    await run(
      client,
      `INSERT INTO system_settings (establishment_id, key, value, description)
       VALUES ($1, $2, $3::jsonb, $4) ON CONFLICT (establishment_id, key) DO NOTHING`,
      [establishmentId, key, value, description],
    );
  }
}

module.exports = {
  findAll, findById, create, update, setActive, usersFor, stats,
  createAdminForEstablishment, createDefaultSettings,
};
