'use strict';

function parsePagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

function buildMeta(total, { page, limit }) {
  return {
    page,
    limit,
    total: Number(total),
    totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
  };
}

function ok(res, data, meta, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

module.exports = { parsePagination, buildMeta, ok };
