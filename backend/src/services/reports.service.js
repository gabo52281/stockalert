'use strict';

const repository = require('../repositories/analytics.repository');
const { buildPdf } = require('./pdf.service');

const CATALOG = [
  { name: 'inventory', label: 'Inventario actual' },
  { name: 'low-stock', label: 'Productos con stock bajo' },
  { name: 'critical', label: 'Productos críticos y agotados' },
  { name: 'movements-in', label: 'Historial de entradas' },
  { name: 'movements-out', label: 'Historial de salidas' },
  { name: 'movements-range', label: 'Movimientos por rango de fechas' },
  { name: 'movements-by-user', label: 'Movimientos por usuario' },
  { name: 'top-products', label: 'Productos con mayores salidas' },
  { name: 'coverage', label: 'Cobertura de inventario' },
  { name: 'valuation', label: 'Valoración estimada del inventario' },
];

function slug(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function csvValue(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",;\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsv(report) {
  const filters = Object.entries(report.filters || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join(' | ');

  const lines = [
    `# STOCKALERT - ${report.title}`,
    `# Generado: ${new Date().toISOString()}`,
    `# Filtros: ${filters || 'ninguno'}`,
    report.columns.map((column) => csvValue(column.label)).join(','),
    ...report.rows.map((row) => report.columns.map((column) => csvValue(row[column.key])).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

async function catalog() {
  return CATALOG;
}

async function exportReport(name, filters, format) {
  const report = await repository.reportData(name, filters);
  const filenameBase = `stockalert-${slug(name)}-${new Date().toISOString().slice(0, 10)}`;

  if (format === 'csv') {
    return {
      content: Buffer.from(buildCsv(report), 'utf8'),
      contentType: 'text/csv; charset=utf-8',
      filename: `${filenameBase}.csv`,
    };
  }
  if (format === 'pdf') {
    return {
      content: await buildPdf(report),
      contentType: 'application/pdf',
      filename: `${filenameBase}.pdf`,
    };
  }
  return { data: report };
}

module.exports = { catalog, exportReport };
