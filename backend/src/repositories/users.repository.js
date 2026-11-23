'use strict';

const { query } = require('../config/database');
const { tenantPredicate } = require('../config/tenant');

const COLUMNS = `
  u.id, u.name, u.email, u.active, u.establishment_id,
  e.name AS establishment_name, u.created_at, u.updated_at,
  r.name AS role, r.description AS role_description
`;

async function findAll({ q, search, role, active, establishmentId, limit, offset }) {
  const where = [];
  const values = [];
  const term = q || search;

  if (term) {
    values.push(`%${term}%`);
    where.push(`(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length})`);
  }
  if (role) {
    values.push(role);
    where.push(`r.name = $${values.length}`);
  }
  if (active !== undefined && active !== null) {
    values.push(active);
    where.push(`u.active = $${values.length}`);
  }
  if (establishmentId !== undefined && establishmentId !== null && establishmentId !== '') {
    values.push(establishmentId);
    where.push(`u.establishment_id = $${values.length}`);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = 'FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN establishments e ON e.id = u.establishment_id';
  const [rows, count] = await Promise.all([
    query(
      `SELECT ${COLUMNS} ${from}
       ${clause} ORDER BY u.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    query(`SELECT count(*)::int AS total ${from} ${clause}`, values),
  ]);

  return { rows: rows.rows, total: count.rows[0].total };
}

/** Nombres del propio establecimiento para filtros de movimientos/reportes. */
async function findTenantOptions() {
  const { rows } = await query(
    `SELECT u.id, u.name
       FROM users u
      WHERE u.active AND ${tenantPredicate('u')}
      ORDER BY u.name, u.id`,
  );
  return rows;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM users u JOIN roles r ON r.id = u.role_id
      LEFT JOIN establishments e ON e.id = u.establishment_id WHERE u.id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function findByEmailForAuth(id) {
  const { rows } = await query('SELECT id, email, password_hash FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByEmail(email) {
  const { rows } = await query(
    `SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id
      WHERE lower(u.email) = lower($1)`,
    [email],
  );
  return rows[0] || null;
}

async function create({
  name, email, passwordHash, role, active, establishmentId,
}) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role_id, active, establishment_id)
     VALUES ($1, $2, $3, (SELECT id FROM roles WHERE name = $4), $5, $6)
     RETURNING id, name, email, active, establishment_id, created_at`,
    [name, email.toLowerCase(), passwordHash, role, active, establishmentId ?? null],
  );
  return rows[0];
}

async function update(id, fields) {
  const map = {
    name: 'name', email: 'email', role: 'role_id', active: 'active',
    establishmentId: 'establishment_id',
  };
  const sets = [];
  const values = [id];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    values.push(key === 'role' ? value : value);
    const column = map[key];
    if (key === 'role') {
      sets.push(`role_id = (SELECT id FROM roles WHERE name = $${values.length})`);
    } else {
      sets.push(`${column} = $${values.length}`);
    }
  }

  if (sets.length === 0) return findById(id);

  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING id`,
    values,
  );
  return findById(rows[0].id);
}

async function setPassword(id, hash) {
  await query(
    `UPDATE users
        SET password_hash = $1,
            password_version = password_version + 1
      WHERE id = $2`,
    [hash, id],
  );
}

async function revokeToken(jti, userId, expiresAt) {
  await query(
    'INSERT INTO revoked_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [jti, userId, new Date(expiresAt * 1000)],
  );
  await query('DELETE FROM revoked_tokens WHERE expires_at < now()');
}

module.exports = {
  findAll, findTenantOptions, findById, findByEmail, findByEmailForAuth, create, update, setPassword, revokeToken,
};
