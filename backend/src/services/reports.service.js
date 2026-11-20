'use strict';

const repository = require('../repositories/analytics.repository');
const { buildPdf } = require('./pdf.service');
const {
  formatCurrencyCOP,
  formatDateValue,
  formatFilterValue,
  formatReportValue,
  parseNumeric,
} = require('../utils/format');

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

function asNumber(value) {
  const parsed = parseNumeric(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integer(value) {
  return formatReportValue(Math.round(asNumber(value)), { format: 'integer' });
}

function money(value) {
  return formatCurrencyCOP(asNumber(value));
}

function decimal(value) {
  return formatReportValue(value, { format: 'decimal' });
}

function periodLabel(filters, fallback = 'Generado hoy') {
  const from = filters.from ? formatDateValue(filters.from, false) : null;
  const to = filters.to ? formatDateValue(filters.to, false) : null;
  if (from && to) return `${from} a ${to}`;
  if (from) return `Desde ${from}`;
  if (to) return `Hasta ${to}`;
  return fallback;
}

function countLevel(rows, level) {
  return rows.filter((row) => row.alert_level === level).length;
}

function inventorySummary(report) {
  const rows = report.rows || [];
  const units = rows.reduce((sum, row) => sum + asNumber(row.quantity), 0);
  const value = rows.reduce(
    (sum, row) => sum + (row.inventory_value !== undefined
      ? asNumber(row.inventory_value)
      : asNumber(row.quantity) * asNumber(row.purchase_price)),
    0,
  );
  return [
    { label: 'Productos', value: integer(rows.length) },
    { label: 'Existencias totales', value: integer(units) },
    { label: 'Valor del inventario', value: money(value) },
    { label: 'Críticos / agotados', value: `${integer(countLevel(rows, 'CRITICO'))} / ${integer(countLevel(rows, 'AGOTADO'))}` },
    { label: 'Período', value: periodLabel(report.filters) },
  ];
}

function movementsSummary(report) {
  const rows = report.rows || [];
  const entries = rows.filter((row) => row.type === 'IN');
  const exits = rows.filter((row) => row.type === 'OUT');
  const units = rows.reduce((sum, row) => sum + asNumber(row.quantity), 0);
  return [
    { label: 'Movimientos', value: integer(rows.length) },
    { label: 'Entradas', value: integer(entries.length) },
    { label: 'Salidas', value: integer(exits.length) },
    { label: 'Unidades movidas', value: integer(units) },
    { label: 'Período', value: periodLabel(report.filters, 'Historial disponible') },
  ];
}

function valuationSummary(report) {
  const rows = report.rows || [];
  const purchase = rows.reduce((sum, row) => sum + asNumber(row.inventory_value), 0);
  const sale = rows.reduce((sum, row) => sum + asNumber(row.inventory_sale_value), 0);
  const units = rows.reduce((sum, row) => sum + asNumber(row.quantity), 0);
  return [
    { label: 'Productos', value: integer(rows.length) },
    { label: 'Valor de compra', value: money(purchase) },
    { label: 'Valor de venta', value: money(sale) },
    { label: 'Existencias', value: integer(units) },
    { label: 'Período', value: periodLabel(report.filters) },
  ];
}

function coverageSummary(report) {
  const rows = report.rows || [];
  const withCoverage = rows.filter((row) => asNumber(row.coverage_days) > 0);
  const average = withCoverage.length
    ? withCoverage.reduce((sum, row) => sum + asNumber(row.coverage_days), 0) / withCoverage.length
    : 0;
  return [
    { label: 'Productos', value: integer(rows.length) },
    { label: 'Cobertura promedio', value: `${decimal(average)} días` },
    { label: 'Sin cálculo', value: integer(rows.length - withCoverage.length) },
    { label: 'Críticos / agotados', value: `${integer(countLevel(rows, 'CRITICO'))} / ${integer(countLevel(rows, 'AGOTADO'))}` },
    { label: 'Período', value: periodLabel(report.filters, 'Ventana configurada') },
  ];
}

function topProductsSummary(report) {
  const rows = report.rows || [];
  const units = rows.reduce((sum, row) => sum + asNumber(row.total_out), 0);
  const movements = rows.reduce((sum, row) => sum + asNumber(row.movements), 0);
  return [
    { label: 'Productos', value: integer(rows.length) },
    { label: 'Unidades salidas', value: integer(units) },
    { label: 'Movimientos', value: integer(movements) },
    { label: 'Existencias actuales', value: integer(rows.reduce((sum, row) => sum + asNumber(row.quantity), 0)) },
    { label: 'Período', value: periodLabel(report.filters, 'Últimos 30 días') },
  ];
}

function buildSummary(name, report) {
  if (name === 'valuation') return valuationSummary(report);
  if (name === 'coverage') return coverageSummary(report);
  if (name === 'top-products') return topProductsSummary(report);
  if (name.startsWith('movements-')) return movementsSummary(report);
  return inventorySummary(report);
}

function buildCsv(report) {
  const filters = Object.entries(report.filters || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      const label = {
        from: 'Desde', to: 'Hasta', productId: 'Producto', categoryId: 'Categoría',
        supplierId: 'Proveedor', userId: 'Usuario', type: 'Tipo', status: 'Estado',
      }[key] || key;
      const resolved = report.filterLabels?.[key] ?? formatFilterValue(value);
      return `${label}: ${resolved}`;
    })
    .join(' | ');

  const generatedAt = report.generatedAt ? formatDateValue(report.generatedAt, true) : formatDateValue(new Date(), true);
  const lines = [
    `# STOCKALERT - ${report.title}`,
    `# Generado: ${generatedAt}`,
    `# Filtros: ${filters || 'ninguno'}`,
    report.columns.map((column) => csvValue(column.label)).join(','),
    ...report.rows.map((row) => report.columns
      .map((column) => csvValue(formatReportValue(row[column.key], column))).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

async function catalog() {
  return CATALOG;
}

async function exportReport(name, filters, format) {
  const { format: _format, ...cleanFilters } = filters || {};
  const report = await repository.reportData(name, cleanFilters);
  report.summary = buildSummary(name, report);
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
