'use strict';

const {
  alertSettingsSchema, movementInSchema, movementOutSchema, productCreateSchema,
} = require('../src/validations/schemas');
const { formatFilterValue, formatReportValue } = require('../src/utils/format');

function parseBody(schema, body) {
  return schema.safeParse({ body });
}

describe('validación estricta de campos numéricos', () => {
  describe('productos', () => {
    const base = { code: 'NUM-001', name: 'Producto numérico' };

    it('acepta enteros reales y cadenas de dígitos', () => {
      const result = parseBody(productCreateSchema, {
        ...base, purchasePrice: 1250000, salePrice: '1500000', minStock: '10', alertPercentage: 25,
      });
      expect(result.success).toBe(true);
      expect(result.data.body).toMatchObject({
        purchasePrice: 1250000, salePrice: 1500000, minStock: 10, alertPercentage: 25,
      });
    });

    it.each([
      ['precio con decimales', { purchasePrice: 1500.5 }],
      ['precio como cadena decimal', { purchasePrice: '1500.50' }],
      ['precio negativo', { purchasePrice: -1 }],
      ['precio en notación científica', { purchasePrice: '1e5' }],
      ['stock mínimo fraccionario', { minStock: 2.5 }],
      ['porcentaje fraccionario', { alertPercentage: 12.5 }],
      ['campo vacío', { salePrice: '' }],
    ])('rechaza %s', (_label, invalid) => {
      expect(parseBody(productCreateSchema, { ...base, ...invalid }).success).toBe(false);
    });
  });

  describe('movimientos', () => {
    it.each([
      ['entrada con decimales', movementInSchema, { productId: 1, quantity: 1.5 }],
      ['salida con decimales', movementOutSchema, { productId: 1, quantity: 2.5, reason: 'Prueba' }],
      ['cantidad negativa', movementInSchema, { productId: 1, quantity: -5 }],
      ['notación científica', movementInSchema, { productId: 1, quantity: '1e5' }],
      ['cadena decimal', movementOutSchema, { productId: 1, quantity: '3,75', reason: 'Prueba' }],
      ['cero', movementInSchema, { productId: 1, quantity: 0 }],
    ])('rechaza %s', (_label, schema, body) => {
      expect(parseBody(schema, body).success).toBe(false);
    });

    it('acepta cantidades enteras mayores que cero', () => {
      expect(parseBody(movementInSchema, { productId: 1, quantity: '15' }).success).toBe(true);
      expect(parseBody(movementOutSchema, { productId: 1, quantity: 100, reason: 'Venta' }).success).toBe(true);
    });
  });

  describe('formato de reportes', () => {
    it('muestra columnas monetarias en COP sin decimales', () => {
      expect(formatReportValue(1250000, { key: 'sale_price', label: 'Precio venta' })).toBe('$ 1.250.000');
      expect(formatReportValue(1500, { key: 'inventory_value', label: 'Valorizado', format: 'currency' })).toBe('$ 1.500');
    });

    it('conserva el formato numérico de las cantidades', () => {
      expect(formatReportValue(1500, { key: 'quantity', label: 'Existencia' })).toBe('1.500');
    });

    it('interpreta los NUMERIC de PostgreSQL como valores, no como miles', () => {
      expect(formatReportValue('10.000', { key: 'quantity', label: 'Existencia' })).toBe('10');
      expect(formatReportValue('1250.000', { key: 'quantity', label: 'Existencia' })).toBe('1.250');
      expect(formatReportValue('1000.00', { key: 'purchase_price', label: 'Precio compra' })).toBe('$ 1.000');
      expect(formatReportValue('1250000.00', { key: 'sale_price', label: 'Precio venta' })).toBe('$ 1.250.000');
    });

    it('formatea fechas en español colombiano', () => {
      expect(formatReportValue('2026-11-20', { key: 'movement_date', label: 'Fecha' })).toBe('20/11/2026');
      expect(formatFilterValue('2026-10-22')).toBe('22/10/2026');
    });
  });

  describe('configuración de alertas', () => {
    it('acepta porcentajes y días enteros dentro de rango', () => {
      const result = alertSettingsSchema.safeParse({
        params: { id: 1 },
        body: { preventivePercentage: 25, analysisWindowDays: '30', minHistoryDays: 7 },
      });
      expect(result.success).toBe(true);
    });

    it('rechaza porcentajes decimales y días fraccionarios', () => {
      expect(alertSettingsSchema.safeParse({
        params: { id: 1 },
        body: { preventivePercentage: 12.5, analysisWindowDays: 30, minHistoryDays: 7 },
      }).success).toBe(false);
      expect(alertSettingsSchema.safeParse({
        params: { id: 1 },
        body: { preventivePercentage: 25, analysisWindowDays: 7.5, minHistoryDays: 7 },
      }).success).toBe(false);
    });
  });
});
