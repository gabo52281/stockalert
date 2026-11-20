const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

export const formatCurrency = (value) => currency.format(Number(value || 0));
export const formatNumber = (value) => number.format(Number(value || 0));

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
    timeZone: 'America/Bogota',
  }).format(date);
}

export const formatDateTime = (value) => formatDate(value, true);

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoISO(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
