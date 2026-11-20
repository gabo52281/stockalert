'use strict';

const { query } = require('../config/database');

/** Registra operaciones sensibles sin bloquear la respuesta ante fallos de auditoría. */
async function writeAudit(req, action, entity, entityId, details = {}) {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id || null,
        action,
        entity,
        entityId == null ? null : String(entityId),
        JSON.stringify(details),
        req.ip || null,
      ],
    );
  } catch (error) {
    console.error('No se pudo escribir auditoría:', error.message);
  }
}

module.exports = { writeAudit };
