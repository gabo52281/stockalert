'use strict';

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

const MONEY_KEYS = new Set([
  'purchase_price', 'sale_price', 'inventory_value', 'inventory_sale_value',
  'estimated_purchase_cost', 'purchaseCost', 'totalValue',
]);

function normalizeSpaces(text) {
  return text.replace(/\u00a0/g, ' ');
}

function isMoneyColumn(column) {
  if (!column) return false;
  if (column.format === 'currency' || MONEY_KEYS.has(column.key)) return true;
  return /precio|valor|inversi[oó]n/i.test(column.label || '');
}

function formatCurrencyCOP(value) {
  return normalizeSpaces(currency.format(Number(value || 0)));
}

/** Formato usado por CSV y PDF: COP sin decimales en columnas monetarias. */
function formatReportValue(value, column) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota',
    }).format(value);
  }
  if (typeof value === 'number') {
    return isMoneyColumn(column) ? formatCurrencyCOP(value) : decimal.format(value);
  }
  return String(value);
}

module.exports = { formatCurrencyCOP, isMoneyColumn, formatReportValue };
