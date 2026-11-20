'use strict';

const { query } = require('../config/database');

const COLUMNS = `
  u.id, u.name, u.email, u.active, u.created_at, u.updated_at,
  r.name AS role, r.description AS role_description
`;

async function findAll({ q, search, role, active, limit, offset }) {
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

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows, count] = await Promise.all([
    query(
      `SELECT ${COLUMNS} FROM users u JOIN roles r ON r.id = u.role_id
       ${clause} ORDER BY u.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
    query(`SELECT count(*)::int AS total FROM users u JOIN roles r ON r.id = u.role_id ${clause}`, values),
  ]);

  return { rows: rows.rows, total: count.rows[0].total };
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [id],
  );
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

async function create({ name, email, passwordHash, role, active }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role_id, active)
     VALUES ($1, $2, $3, (SELECT id FROM roles WHERE name = $4), $5)
     RETURNING id, name, email, active, created_at`,
    [name, email.toLowerCase(), passwordHash, role, active],
  );
  return rows[0];
}

async function update(id, fields) {
  const map = { name: 'name', email: 'email', role: 'role_id', active: 'active' };
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
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
}

async function revokeToken(jti, userId, expiresAt) {
  await query(
    'INSERT INTO revoked_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [jti, userId, new Date(expiresAt * 1000)],
  );
  await query('DELETE FROM revoked_tokens WHERE expires_at < now()');
}

module.exports = {
  findAll, findById, findByEmail, create, update, setPassword, revokeToken,
};
