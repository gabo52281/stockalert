import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  caretForDigitCount, digitsBeforeCaret, formatCurrencyDigits, isIntegerText,
  normalizeDigits, parseCurrencyDigits, parseCurrencyEditing,
} from '../src/utils/numeric.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('los enteros rechazan decimales, signos, notación científica y permiten vacío', () => {
  assert.equal(normalizeDigits('001500'), '1500');
  assert.equal(normalizeDigits('1250000.00'), '1250000');
  assert.equal(normalizeDigits('10.000'), '10');
  assert.equal(formatCurrencyDigits('1500000.00'), '$ 1.500.000');
  assert.equal(isIntegerText(''), false);
  assert.equal(isIntegerText('0'), true);
  assert.equal(isIntegerText('0', { allowZero: false }), false);
  assert.equal(isIntegerText('1.5'), false);
  assert.equal(isIntegerText('-5'), false);
  assert.equal(isIntegerText('1e5'), false);
  assert.equal(isIntegerText('15'), true);
});

test('COP se formatea mientras se escribe, sin decimales', () => {
  const cases = [
    ['1', '$ 1'],
    ['10', '$ 10'],
    ['100', '$ 100'],
    ['1000', '$ 1.000'],
    ['15000', '$ 15.000'],
    ['150000', '$ 150.000'],
    ['1250000', '$ 1.250.000'],
    ['25000000', '$ 25.000.000'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(formatCurrencyDigits(input), expected);
  }
});

test('el analizador COP acepta pegado y edición, pero rechaza decimales y negativos', () => {
  assert.equal(parseCurrencyDigits('$ 1.250.000'), '1250000');
  assert.equal(parseCurrencyDigits('$ 1.500.000'), '1500000');
  assert.equal(parseCurrencyDigits('1500'), '1500');
  assert.equal(parseCurrencyDigits(''), '');
  assert.equal(parseCurrencyDigits('1500000.00'), null);
  assert.equal(parseCurrencyDigits('1,5'), null);
  assert.equal(parseCurrencyDigits('-100'), null);
  assert.equal(parseCurrencyDigits('1e5'), null);
});

test('borrar en vivo no restaura el valor anterior ni acepta decimales', () => {
  assert.equal(parseCurrencyEditing('', '1250000'), '');
  assert.equal(parseCurrencyEditing('$ 1.250.00', '1250000'), '125000');
  assert.equal(parseCurrencyEditing('$ 1.20.000', '1250000'), '120000');
  assert.equal(parseCurrencyEditing('5', '1250000'), '5');
  assert.equal(parseCurrencyEditing('$ 50.000', ''), '50000');
  assert.equal(parseCurrencyEditing('$ 1.250.0005', '1250000'), '12500005');
  assert.equal(parseCurrencyEditing('1500000.00', '1250000'), null);
  assert.equal(parseCurrencyEditing('1,5', '1250000'), null);
  assert.equal(parseCurrencyEditing('-5', '1250000'), null);
  assert.equal(parseCurrencyEditing('1e5', '1250000'), null);
});

test('el cursor se conserva al insertar o borrar en medio', () => {
  const formatted = '$ 1.250.000';
  const caret = digitsBeforeCaret(formatted, 6);
  assert.equal(caret, 3);
  assert.equal(caretForDigitCount(formatted, caret), 6);
  assert.equal(caretForDigitCount(formatted, 0), 0);
});

test('no quedan inputs numéricos nativos en los formularios', () => {
  const files = [
    'src/pages/ProductsPage.jsx',
    'src/pages/MovementsPage.jsx',
  ];
  for (const file of files) {
    const source = readFileSync(join(root, file), 'utf8');
    assert.doesNotMatch(source, /type=["']number["']/, `${file} no debe usar type="number"`);
  }
});
