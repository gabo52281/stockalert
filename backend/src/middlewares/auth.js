'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { permissionsFor } = require('../config/permissions');

function signToken(user) {
  const jti = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const token = jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role, jti },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
  return { token, jti };
}

async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw ApiError.unauthorized('Se requiere un token Bearer');
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw ApiError.unauthorized('Token inválido o expirado');
    }

    const revoked = await query('SELECT 1 FROM revoked_tokens WHERE jti = $1', [payload.jti]);
    if (revoked.rowCount > 0) {
      throw ApiError.unauthorized('La sesión fue cerrada');
    }

    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.active, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1`,
      [payload.sub],
    );

    if (rows.length === 0 || !rows[0].active) {
      throw ApiError.unauthorized('Usuario inexistente o inactivo');
    }

    req.user = { ...rows[0], permissions: permissionsFor(rows[0].role) };
    req.token = { jti: payload.jti, expiresAt: payload.exp };
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { authenticate, signToken };
