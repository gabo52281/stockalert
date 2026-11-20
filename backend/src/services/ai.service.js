'use strict';

const repository = require('../repositories/ai.repository');

const DEFAULT_OPTIONS = {
  days: 30,
  leadTimeDays: 14,
  limit: 8,
};

const DAY_MS = 86400000;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Convierte las filas de la BD en una serie diaria continua, rellenando ceros. */
function normalizeSeries(rows = [], days = DEFAULT_OPTIONS.days) {
  const byDay = new Map();
  for (const row of rows) {
    const day = String(row.day || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    byDay.set(day, (byDay.get(day) || 0) + toNumber(row.units));
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const series = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today.getTime() - index * DAY_MS).toISOString().slice(0, 10);
    series.push({ date, units: round(byDay.get(date) || 0) });
  }
  return series;
}

/**
 * Suavizado exponencial con tendencia atenuada. Es un modelo local explicable:
 * no envía datos a servicios externos y funciona con el historial ya registrado.
 */
function forecastDailyDemand(series, days = DEFAULT_OPTIONS.days) {
  const values = normalizeSeries(series, days).map((point) => point.units);
  const total = values.reduce((sum, value) => sum + value, 0);
  const activeDays = values.filter((value) => value > 0).length;

  if (values.length === 0 || total <= 0) {
    return {
      dailyDemand: 0,
      trend: 0,
      volatility: 0,
      confidence: 'sin_historial',
      historyDays: values.length,
      activeDays: 0,
      totalUnits: 0,
    };
  }

  const alpha = 0.35;
  let level = values[0];
  for (let index = 1; index < values.length; index += 1) {
    level = alpha * values[index] + (1 - alpha) * level;
  }

  const meanX = (values.length - 1) / 2;
  const meanY = total / values.length;
  let covariance = 0;
  let varianceX = 0;
  values.forEach((value, index) => {
    covariance += (index - meanX) * (value - meanY);
    varianceX += (index - meanX) ** 2;
  });
  const trend = varianceX > 0 ? covariance / varianceX : 0;
  const dampedTrend = trend * 0.25;
  const varianceY = values.reduce((sum, value) => sum + (value - meanY) ** 2, 0) / values.length;

  return {
    dailyDemand: round(Math.max(0, level + dampedTrend)),
    trend: round(dampedTrend),
    volatility: round(Math.sqrt(varianceY)),
    confidence: activeDays >= 7 ? 'alta' : activeDays >= 3 ? 'media' : 'baja',
    historyDays: values.length,
    activeDays,
    totalUnits: round(total),
  };
}

function detectAnomaly(series, days = DEFAULT_OPTIONS.days) {
  const values = normalizeSeries(series, days).map((point) => point.units);
  if (values.length < 7) return { detected: false, score: 0, latestUnits: values.at(-1) || 0 };

  const baseline = values.slice(0, -1);
  const mean = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
  const variance = baseline.reduce((sum, value) => sum + (value - mean) ** 2, 0) / baseline.length;
  const deviation = Math.sqrt(variance);
  const latest = values.at(-1) || 0;
  const score = deviation > 0
    ? (latest - mean) / deviation
    : mean > 0 ? (latest / mean - 1) * 2 : 0;
  const detected = latest > 0 && (deviation > 0 ? score >= 2 : latest >= mean * 3);

  return {
    detected,
    score: round(score),
    latestUnits: round(latest),
    expectedUnits: round(mean),
  };
}

const RISK_WEIGHT = { CRITICO: 45, ALTO: 35, MEDIO: 20, BAJO: 5 };

function analyzeProduct(product, series, options = {}) {
  const days = Number(options.days) || DEFAULT_OPTIONS.days;
  const leadTimeDays = Number(options.leadTimeDays) || DEFAULT_OPTIONS.leadTimeDays;
  const forecast = forecastDailyDemand(series, days);
  const anomaly = detectAnomaly(series, days);

  const stock = Math.max(0, toNumber(product.quantity));
  const minStock = toNumber(product.min_stock);
  const safetyStock = Math.ceil(1.65 * forecast.volatility * Math.sqrt(leadTimeDays));
  const expectedDemand = round(forecast.dailyDemand * leadTimeDays);
  const reorderPoint = Math.ceil(expectedDemand + safetyStock);
  const suggestedQty = Math.max(0, Math.ceil(reorderPoint - stock));
  const daysOfCover = forecast.dailyDemand > 0 ? round(stock / forecast.dailyDemand, 1) : null;

  let risk = 'BAJO';
  if (product.alert_level === 'AGOTADO' || stock <= 0) risk = 'CRITICO';
  else if (daysOfCover !== null && daysOfCover < leadTimeDays / 2) risk = 'ALTO';
  else if (stock <= reorderPoint || product.alert_level === 'CRITICO') risk = 'MEDIO';

  const urgency = daysOfCover === null
    ? 0
    : clamp((1 - daysOfCover / (leadTimeDays * 2)) * 30, 0, 30);
  const priority = clamp(RISK_WEIGHT[risk] + urgency + (suggestedQty > 0 ? 10 : 0), 0, 100);

  const reason = forecast.dailyDemand > 0
    ? `Demanda estimada de ${round(forecast.dailyDemand)} uds/día. Con ${stock} uds disponibles y ${leadTimeDays} días de reposición, el punto de pedido sugerido es ${reorderPoint} uds.`
    : 'Sin salidas suficientes en el periodo analizado; la recomendación se basa en el estado de alerta y el stock mínimo.';

  return {
    id: toNumber(product.id),
    code: product.code,
    name: product.name,
    category: product.category_name || 'Sin categoría',
    supplier: product.supplier_name || 'Sin proveedor',
    stock,
    minStock,
    alertLevel: product.alert_level,
    purchasePrice: toNumber(product.purchase_price),
    forecastDailyDemand: forecast.dailyDemand,
    forecastConfidence: forecast.confidence,
    activeDays: forecast.activeDays,
    expectedDemand,
    safetyStock,
    reorderPoint,
    suggestedQty,
    daysOfCover,
    risk,
    priority,
    anomaly: anomaly.detected,
    anomalyScore: anomaly.score,
    reason,
  };
}

function buildInsights(products, movements, options = {}) {
  const days = Number(options.days) || DEFAULT_OPTIONS.days;
  const leadTimeDays = Number(options.leadTimeDays) || DEFAULT_OPTIONS.leadTimeDays;
  const limit = Number(options.limit) || DEFAULT_OPTIONS.limit;

  const seriesByProduct = new Map();
  for (const movement of movements) {
    const key = String(movement.product_id);
    if (!seriesByProduct.has(key)) seriesByProduct.set(key, []);
    seriesByProduct.get(key).push(movement);
  }

  const analyses = products.map((product) => analyzeProduct(
    product,
    seriesByProduct.get(String(product.id)) || [],
    { days, leadTimeDays },
  ));

  const ranked = [...analyses].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
  const recommendations = ranked
    .filter((item) => item.suggestedQty > 0 || item.risk === 'CRITICO' || item.risk === 'ALTO')
    .slice(0, limit);
  const anomalies = ranked.filter((item) => item.anomaly).slice(0, limit);

  const unitsToReplenish = analyses.reduce((sum, item) => sum + item.suggestedQty, 0);
  const estimatedPurchaseCost = analyses.reduce(
    (sum, item) => sum + item.suggestedQty * item.purchasePrice,
    0,
  );
  const highRisk = analyses.filter((item) => item.risk === 'CRITICO' || item.risk === 'ALTO').length;

  const summary = {
    analyzedProducts: analyses.length,
    replenishmentProducts: analyses.filter((item) => item.suggestedQty > 0).length,
    highRiskProducts: highRisk,
    anomalyProducts: analyses.filter((item) => item.anomaly).length,
    unitsToReplenish,
    estimatedPurchaseCost: round(estimatedPurchaseCost),
  };

  const narrative = analyses.length === 0
    ? 'No hay productos activos para analizar.'
    : `Se analizaron ${analyses.length} productos activos. ${summary.highRiskProducts} tienen riesgo alto o crítico y ${summary.replenishmentProducts} necesitan reposición. La inversión estimada para cubrir la demanda de ${leadTimeDays} días es ${round(estimatedPurchaseCost)}.`;

  return {
    generatedAt: new Date().toISOString(),
    parameters: { days, leadTimeDays, limit },
    summary,
    narrative,
    recommendations,
    anomalies,
  };
}

async function insights(options = {}) {
  const days = Number(options.days) || DEFAULT_OPTIONS.days;
  const { products, movements } = await repository.loadInventorySignals(days);
  return buildInsights(products, movements, options);
}

module.exports = {
  DEFAULT_OPTIONS,
  normalizeSeries,
  forecastDailyDemand,
  detectAnomaly,
  analyzeProduct,
  buildInsights,
  insights,
};
