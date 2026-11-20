'use strict';

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

const decimal = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0, maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  timeZone: 'America/Bogota',
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bogota',
});

const MONEY_KEYS = new Set([
  'purchase_price', 'sale_price', 'inventory_value', 'inventory_sale_value',
  'estimated_purchase_cost', 'purchaseCost', 'totalValue', 'cost', 'totalCost',
  'budget', 'remaining', 'inversion',
]);

const INTEGER_KEYS = new Set([
  'quantity', 'min_stock', 'preventive_threshold', 'total_out', 'movements',
  'stock_before', 'stock_after', 'out_units_window', 'in_units_window',
  'out_movements_window', 'suggestedQty', 'reorderPoint', 'safetyStock',
  'expectedDemand', 'unitsToReplenish', 'activeDays', 'historyDays',
  'totalUnits', 'total_out_units', 'units',
]);

const DECIMAL_KEYS = new Set([
  'avg_daily_out', 'coverage_days', 'coverageDays', 'daysOfCover',
  'forecastDailyDemand', 'dailyDemand', 'priority', 'anomalyScore',
]);

const DATE_KEYS = new Set([
  'movement_date', 'created_at', 'updated_at', 'last_movement_at',
  'generatedAt', 'from', 'to', 'date',
]);

function normalizeSpaces(text) {
  return String(text).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function isMoneyColumn(column) {
  if (!column) return false;
  if (column.format === 'currency' || column.format === 'money') return true;
  if (MONEY_KEYS.has(column.key)) return true;
  return /precio|valor|inversi[oó]n|compra|venta|costo/i.test(column.label || '');
}

function isDateColumn(column) {
  if (!column) return false;
  if (column.format === 'date' || column.format === 'datetime') return true;
  if (DATE_KEYS.has(column.key)) return true;
  return /fecha/i.test(column.label || '');
}

function isDecimalColumn(column) {
  if (!column) return false;
  if (column.format === 'decimal') return true;
  if (DECIMAL_KEYS.has(column.key)) return true;
  return /promedio|prom\.|d[ií]as|cobertura/i.test(column.label || '');
}

function isIntegerColumn(column) {
  if (!column) return false;
  if (column.format === 'integer') return true;
  if (INTEGER_KEYS.has(column.key)) return true;
  return /cantidad|existencia|m[ií]nimo|unidades|stock|movimientos/i.test(column.label || '');
}

function formatCurrencyCOP(value) {
  const parsed = Number(value);
  return normalizeSpaces(currency.format(Number.isFinite(parsed) ? parsed : 0));
}

/**
 * PostgreSQL NUMERIC llega como cadena ("10.000", "1000.00", "1250000.00").
 * Se interpreta primero como número: el punto es escala decimal de Postgres.
 * Solo se tratan como agrupadores de miles los formatos ya presentados al usuario
 * ($ 1.250.000, 1.250.000 o 1.250,00).
 */
function parseNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  let text = normalizeSpaces(value).replace(/[$€£]/g, '');
  if (!text || !/[\d]/.test(text)) return null;

  const isNegative = /^-/.test(text);
  text = text.replace(/^[+-]/, '');
  const hasComma = text.includes(',');

  if (hasComma) {
    if (/,\d{1,2}$/.test(text)) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if ((text.match(/\./g) || []).length > 1) {
    text = text.replace(/\./g, '');
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return isNegative ? -parsed : parsed;
}

function formatDateValue(value, withTime = true) {
  if (value === null || value === undefined || value === '') return '';

  let date = value;
  let dateOnly = false;

  if (typeof value === 'string') {
    const trimmed = normalizeSpaces(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      // Evita que una fecha sin hora se desplace al día anterior al aplicar Bogotá.
      date = new Date(`${trimmed}T12:00:00-03:00`);
      dateOnly = true;
    } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(trimmed)) {
      date = new Date(trimmed);
    } else {
      return trimmed;
    }
  }

  if (typeof value === 'number') date = new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return String(value);

  return (dateOnly || !withTime ? dateFormatter : dateTimeFormatter).format(date);
}

/** Formato usado por CSV y PDF: COP sin decimales y cantidades enteras. */
function formatReportValue(value, column) {
  if (value === null || value === undefined) return '';

  if (value instanceof Date || isDateColumn(column)) {
    return formatDateValue(value, true);
  }

  const parsed = parseNumeric(value);
  if (parsed !== null) {
    if (isMoneyColumn(column)) return formatCurrencyCOP(parsed);
    if (isIntegerColumn(column)) return integer.format(Math.round(parsed));
    if (isDecimalColumn(column)) return decimal.format(parsed);
    return decimal.format(parsed);
  }

  return normalizeSpaces(value);
}

/** Etiquetas legibles para los filtros de reportes y de chat. */
function formatFilterValue(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return formatDateValue(value, true);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(value)) {
    return formatDateValue(value, false);
  }
  return formatReportValue(value);
}

module.exports = {
  formatCurrencyCOP,
  formatDateValue,
  formatFilterValue,
  formatReportValue,
  isDateColumn,
  isDecimalColumn,
  isIntegerColumn,
  isMoneyColumn,
  normalizeSpaces,
  parseNumeric,
};
