import { formatCurrency } from './format.js';

/** Devuelve solo los dígitos de un valor, descartando símbolos y separadores. */
export function digitsOnly(value) {
  const source = typeof value === 'number' ? String(Math.trunc(value)) : String(value ?? '');
  return source.replace(/\D/g, '');
}

/** Normaliza una cadena de dígitos: elimina ceros a la izquierda y conserva vacío. */
export function normalizeDigits(value) {
  const digits = digitsOnly(value);
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '');
}

/** Comprueba que el texto contenga únicamente dígitos y respete el mínimo. */
export function isIntegerText(value, { allowZero = true } = {}) {
  const text = String(value ?? '');
  if (!/^\d+$/.test(text)) return false;
  if (!allowZero && Number(text) === 0) return false;
  return true;
}

/**
 * Interpreta la edición de un campo COP. Acepta dígitos, el símbolo `$`,
 * espacios y puntos de miles. Rechaza decimales, signos y notación científica.
 * Devuelve `null` cuando la entrada no es válida.
 */
export function parseCurrencyDigits(value) {
  let text = String(value ?? '').trim();
  if (!text) return '';
  if (/[-+eE]/.test(text)) return null;

  text = text.replace(/[\s\u00a0]/g, '').replace(/\$/g, '');
  if (!text) return '';
  if (/[^0-9.]/.test(text)) return null;
  if (text.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(text)) return null;

  return normalizeDigits(text.replace(/\./g, ''));
}

/** Formatea una cadena de dígitos como COP sin decimales. */
export function formatCurrencyDigits(value) {
  const digits = normalizeDigits(value);
  return digits ? formatCurrency(digits) : '';
}

/** Cuenta cuántos dígitos hay antes del cursor en el texto visible. */
export function digitsBeforeCaret(text, caret) {
  const position = Math.max(0, Math.min(caret ?? 0, text.length));
  return (text.slice(0, position).match(/\d/g) || []).length;
}

/** Devuelve la posición del cursor después de n dígitos en el texto formateado. */
export function caretForDigitCount(text, digitCount) {
  if (!digitCount) return 0;
  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (/\d/.test(text[index])) {
      seen += 1;
      if (seen === digitCount) return index + 1;
    }
  }
  return text.length;
}
