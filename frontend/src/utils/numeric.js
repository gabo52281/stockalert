import { formatCurrency } from './format.js';

/**
 * Devuelve solo los dígitos enteros de un valor, descartando símbolos y
 * separadores. PostgreSQL devuelve `numeric` como texto con decimales
 * (`1250000.00`, `10.000`): se conserva solo la parte entera para no
 * convertir `1250000.00` en `125000000`.
 */
export function digitsOnly(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.trunc(value)) : '';
  }
  const text = String(value ?? '').trim();
  if (!text) return '';
  const decimal = text.match(/^-?(\d+)[.,]\d+$/);
  if (decimal) return decimal[1];
  return text.replace(/\D/g, '');
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
 * Analizador estricto de COP. Acepta dígitos, `$`, espacios y puntos de miles
 * completos. Rechaza decimales, signos y notación científica. Se usa para
 * validar valores definitivos y pegados desde el portapapeles.
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

/**
 * Analizador para edición en vivo. A diferencia del estricto, acepta estados
 * intermedios propios de borrar con Backspace/Delete dentro de un número
 * formateado (`$ 1.250.00`, `$ 1.20.000`, etc.). Nunca devuelve el valor
 * anterior: devuelve `''` o los dígitos resultantes, y `null` si el texto
 * contiene caracteres que no pertenecen a COP.
 */
export function parseCurrencyEditing(value, previousDigits = '') {
  const raw = String(value ?? '');
  if (raw === '') return '';
  if (/[-+eE,]/.test(raw) || /[^\d$.\s\u00a0]/.test(raw)) return null;

  const previous = normalizeDigits(previousDigits);
  const compact = raw.replace(/[\s\u00a0$]/g, '');
  if (!/\d/.test(compact)) return '';

  const strict = parseCurrencyDigits(raw);
  if (strict !== null && strict !== '') return strict;

  const digits = normalizeDigits(compact.replace(/\./g, ''));
  const dotCount = (compact.match(/\./g) || []).length;
  const previousDots = (formatCurrencyDigits(previous).match(/\./g) || []).length;
  const groups = compact.split('.');

  if (digits.length <= previous.length) {
    // Borrar: los puntos se vuelven a reconstruir al formatear. Se permiten
    // grupos parciales para que borrar un dígito intermedio no revierta el campo.
    return groups.every((group) => /^\d{0,3}$/.test(group)) ? digits : null;
  }

  // Insertar: solo se aceptan dígitos nuevos; añadir puntos equivaldría a
  // escribir un decimal o un separador inválido.
  if (dotCount > previousDots) return null;
  const validGroups = groups.every((group, index) => (
    index === 0 ? /^\d{1,3}$/.test(group) : /^\d{1,4}$/.test(group)
  ));
  return validGroups ? digits : null;
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
