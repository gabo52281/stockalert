'use strict';

const {
  normalizeSeries,
  forecastDailyDemand,
  detectAnomaly,
  analyzeProduct,
  buildInsights,
} = require('../src/services/ai.service');

const DAY_MS = 86400000;

function makeSeries(days, unitsForIndex) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => ({
    day: new Date(start.getTime() - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10),
    units: unitsForIndex(index),
  }));
}

describe('IA local de inventario', () => {
  it('normaliza la serie diaria y rellena los días sin movimientos', () => {
    const series = makeSeries(7, (index) => (index === 6 ? 4 : 0));
    const normalized = normalizeSeries(series, 7);

    expect(normalized).toHaveLength(7);
    expect(normalized.at(-1).units).toBe(4);
    expect(normalized.slice(0, 6).every((point) => point.units === 0)).toBe(true);
  });

  it('devuelve confianza sin historial cuando no hay salidas', () => {
    const forecast = forecastDailyDemand(makeSeries(7, () => 0), 7);

    expect(forecast.dailyDemand).toBe(0);
    expect(forecast.confidence).toBe('sin_historial');
    expect(forecast.activeDays).toBe(0);
  });

  it('estima demanda constante y detecta tendencia creciente', () => {
    const constant = forecastDailyDemand(makeSeries(14, () => 5), 14);
    const growing = forecastDailyDemand(makeSeries(14, (index) => index + 1), 14);

    expect(constant.dailyDemand).toBeCloseTo(5, 2);
    expect(constant.trend).toBeCloseTo(0, 2);
    expect(growing.dailyDemand).toBeGreaterThan(5);
    expect(growing.trend).toBeGreaterThan(0);
  });

  it('detecta un pico atípico por encima de dos desviaciones', () => {
    const anomaly = detectAnomaly(makeSeries(14, (index) => (index === 13 ? 40 : 5)), 14);

    expect(anomaly.detected).toBe(true);
    expect(anomaly.latestUnits).toBe(40);
    expect(anomaly.expectedUnits).toBeCloseTo(5, 2);
  });

  it('sugiere reposición y calcula riesgo según cobertura', () => {
    const product = {
      id: 1,
      code: 'IA-001',
      name: 'Producto con demanda',
      category_name: 'Bebidas',
      supplier_name: 'Proveedor A',
      quantity: 2,
      min_stock: 10,
      purchase_price: 100,
      alert_level: 'BAJO',
    };
    const result = analyzeProduct(product, makeSeries(30, () => 3), { days: 30, leadTimeDays: 14 });

    expect(result.forecastDailyDemand).toBeCloseTo(3, 2);
    expect(result.reorderPoint).toBe(42);
    expect(result.suggestedQty).toBe(40);
    expect(result.daysOfCover).toBeCloseTo(0.7, 2);
    expect(result.risk).toBe('ALTO');
    expect(result.priority).toBeGreaterThan(40);
  });

  it('no sugiere reposición cuando el stock cubre el punto de pedido', () => {
    const product = {
      id: 2,
      code: 'IA-002',
      name: 'Producto cubierto',
      quantity: 100,
      min_stock: 10,
      purchase_price: 50,
      alert_level: 'NORMAL',
    };
    const result = analyzeProduct(product, makeSeries(30, () => 1), { days: 30, leadTimeDays: 14 });

    expect(result.suggestedQty).toBe(0);
    expect(result.risk).toBe('BAJO');
  });

  it('genera un plan priorizado y un resumen consistente', () => {
    const products = [
      {
        id: 1, code: 'A', name: 'A', quantity: 0, min_stock: 10,
        purchase_price: 10, alert_level: 'AGOTADO',
      },
      {
        id: 2, code: 'B', name: 'B', quantity: 100, min_stock: 5,
        purchase_price: 20, alert_level: 'NORMAL',
      },
    ];
    const movements = [
      ...makeSeries(30, () => 2).map((row) => ({ ...row, product_id: 1 })),
      ...makeSeries(30, () => 1).map((row) => ({ ...row, product_id: 2 })),
    ];

    const result = buildInsights(products, movements, { days: 30, leadTimeDays: 14, limit: 5 });

    expect(result.recommendations[0].code).toBe('A');
    expect(result.summary.analyzedProducts).toBe(2);
    expect(result.summary.unitsToReplenish).toBeGreaterThan(0);
    expect(result.summary.estimatedPurchaseCost).toBeGreaterThan(0);
    expect(result.narrative).toContain('Se analizaron 2 productos activos');
  });
});
