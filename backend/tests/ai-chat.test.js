'use strict';

const env = require('../src/config/env');
const repository = require('../src/repositories/ai.repository');
const {
  UNAVAILABLE_MESSAGE,
  answer,
  classifyIntent,
  localAnswer,
  parseBudget,
  planWithinBudget,
  status,
} = require('../src/services/ai-chat.service');

const recommendations = [
  {
    id: 1, name: 'Arroz integral', suggestedQty: 15, purchasePrice: 10000,
    stock: 2, daysOfCover: 1, risk: 'ALTO', simpleReason: 'Quedan 2 unidades.',
  },
  {
    id: 2, name: 'Aceite vegetal', suggestedQty: 8, purchasePrice: 20000,
    stock: 3, daysOfCover: 2, risk: 'CRITICO', simpleReason: 'Quedan 3 unidades.',
  },
  {
    id: 3, name: 'Azúcar', suggestedQty: 12, purchasePrice: 15000,
    stock: 4, daysOfCover: 3, risk: 'MEDIO', simpleReason: 'Quedan 4 unidades.',
  },
];

const facts = {
  days: 30,
  leadTimeDays: 14,
  summary: {
    products: 28,
    attention: 13,
    runningOut: 13,
    replenishmentProducts: 12,
    unitsToReplenish: 35,
    estimatedPurchaseCost: 510000,
    entries: 36,
    exits: 42,
    movements: 78,
  },
  recommendations,
  runningOut: recommendations,
  lowMovement: recommendations.slice(2),
  budgetPlan: null,
  product: recommendations[0],
};

describe('copiloto conversacional', () => {
  describe('presupuesto determinista', () => {
    it('interpreta presupuestos con separadores colombianos', () => {
      expect(parseBudget('Tengo $ 500.000 para comprar')).toBe(500000);
      expect(parseBudget('Tengo 500 mil pesos')).toBe(500000);
      expect(parseBudget('¿Qué debo comprar esta semana?')).toBeNull();
    });

    it('respeta el presupuesto y usa cantidades enteras', () => {
      const plan = planWithinBudget(recommendations, 200000);

      expect(plan.items.length).toBeGreaterThan(0);
      expect(plan.used).toBeLessThanOrEqual(plan.budget);
      expect(plan.remaining).toBeGreaterThanOrEqual(0);
      expect(plan.items.every((item) => Number.isInteger(item.quantity))).toBe(true);
      expect(String(plan.used)).not.toMatch(/\./);
    });
  });

  describe('intenciones y respuestas locales', () => {
    it('clasifica las preguntas principales', () => {
      expect(classifyIntent('¿Qué debo comprar esta semana?')).toBe('replenish');
      expect(classifyIntent('¿Qué productos se van a agotar?')).toBe('runningOut');
      expect(classifyIntent('Tengo $ 500.000, ¿qué me recomiendas?')).toBe('budget');
      expect(classifyIntent('¿Cuáles tienen menos movimiento?')).toBe('lowMovement');
    });

    it('explica por qué reponer sin depender del modelo externo', () => {
      const answer = localAnswer('why', facts, '¿Por qué debo comprar más arroz?');
      expect(answer.text).toContain('Arroz integral');
      expect(answer.text).toContain('2 unidades');
      expect(answer.text).toContain('15 unidades');
    });

    it('incluye una tabla pequeña con el plan dentro del presupuesto', () => {
      const withPlan = { ...facts, budgetPlan: planWithinBudget(recommendations, 200000) };
      const answer = localAnswer('budget', withPlan, 'Tengo $ 200.000');

      expect(answer.text).toContain('$ 200.000');
      expect(answer.table.rows.length).toBeGreaterThan(0);
      expect(answer.table.rows.every((row) => row.cost.startsWith('$'))).toBe(true);
    });

    it('se niega a modificar el inventario desde el chat', () => {
      const answer = localAnswer('modification', facts, 'Descuenta 5 unidades de arroz');
      expect(answer.text).toContain('No puedo modificar el inventario desde el chat');
    });
  });

  it('informa cuando solo funciona el análisis local', () => {
    const current = status();
    expect(current.mode === 'local' || current.mode === 'ia').toBe(true);
    expect(current).not.toHaveProperty('apiKey');
    expect(current).not.toHaveProperty('OPENROUTER_API_KEY');
  });

  describe('proveedor externo con consentimiento', () => {
    const original = {
      key: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL,
      fetch: global.fetch,
      loadInventorySignals: repository.loadInventorySignals,
      loadMovementTotals: repository.loadMovementTotals,
    };

    beforeEach(() => {
      env.OPENROUTER_API_KEY = 'clave-de-prueba';
      env.OPENROUTER_MODEL = 'openrouter/free';
      repository.loadInventorySignals = async () => ({
        products: [{
          id: 1, code: 'IA-001', name: 'Arroz integral', category_name: 'Granos',
          supplier_name: 'Proveedor A', quantity: 2, min_stock: 10,
          purchase_price: 10000, sale_price: 15000, alert_level: 'BAJO', active: true,
        }],
        movements: Array.from({ length: 14 }, (_, index) => ({
          product_id: 1,
          day: new Date(Date.now() - (13 - index) * 86400000).toISOString().slice(0, 10),
          units: '3.000',
        })),
      });
      repository.loadMovementTotals = async () => [
        { type: 'IN', movements: 2, units: '20.000' },
        { type: 'OUT', movements: 3, units: '30.000' },
      ];
    });

    afterEach(() => {
      env.OPENROUTER_API_KEY = original.key;
      env.OPENROUTER_MODEL = original.model;
      global.fetch = original.fetch;
      repository.loadInventorySignals = original.loadInventorySignals;
      repository.loadMovementTotals = original.loadMovementTotals;
    });

    it('no contacta al proveedor sin consentimiento explícito', async () => {
      let called = false;
      global.fetch = async () => { called = true; throw new Error('No debió llamarse'); };

      const result = await answer({ question: '¿Qué debo comprar esta semana?', consent: false });

      expect(called).toBe(false);
      expect(result.consentRequired).toBe(true);
      expect(result.providerUsed).toBe(false);
    });

    it('usa una cuota agotada para aplicar el mensaje exacto de fallback', async () => {
      let body;
      global.fetch = async (_url, init) => {
        body = JSON.parse(init.body);
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: { code: 'RATE_LIMIT_EXCEEDED' } }),
        };
      };

      const result = await answer({ question: '¿Qué debo comprar esta semana?', consent: true });

      expect(result.notice).toBe(UNAVAILABLE_MESSAGE);
      expect(result.fallback).toBe(true);
      expect(result.mode).toBe('local');
      expect(body.model).toBe('openrouter/free');
      expect(body.models).toBeUndefined();
      expect(body.provider.max_price).toEqual({ prompt: 0, completion: 0 });
    });

    it('aplica el fallback exacto cuando el proveedor responde 402', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 402,
        json: async () => ({ error: { code: 'INSUFFICIENT_CREDITS' } }),
      });

      const result = await answer({ question: '¿Qué debo comprar esta semana?', consent: true });

      expect(result.notice).toBe(UNAVAILABLE_MESSAGE);
      expect(result.fallback).toBe(true);
      expect(result.error).toBe('quota');
      expect(result.providerUsed).toBe(false);
    });

    it('aplica el fallback exacto cuando expira el tiempo de espera', async () => {
      global.fetch = async () => {
        const error = new Error('Abortada por timeout');
        error.name = 'AbortError';
        throw error;
      };

      const result = await answer({ question: '¿Qué debo comprar esta semana?', consent: true });

      expect(result.notice).toBe(UNAVAILABLE_MESSAGE);
      expect(result.fallback).toBe(true);
      expect(result.error).toBe('timeout');
      expect(result.providerUsed).toBe(false);
    });

    it('acepta solo respuestas gratuitas y elimina claves del texto', async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'openrouter/free:free',
          usage: { cost: 0 },
          choices: [{ message: { content: 'Repón 40 unidades. Nunca compartas sk-or-v1-abc123.' } }],
        }),
      });

      const result = await answer({ question: '¿Qué debo comprar esta semana?', consent: true });

      expect(result.mode).toBe('ia');
      expect(result.providerUsed).toBe(true);
      expect(result.text).toContain('Repón 40 unidades');
      expect(result.text).not.toContain('sk-or-v1-abc123');
      expect(result.text).toContain('[CLAVE OCULTA]');
    });

    it('rechaza un modelo de pago aunque informe costo cero', async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-4o',
          usage: { cost: 0 },
          choices: [{ message: { content: 'Respuesta de pago' } }],
        }),
      });

      const result = await answer({ question: '¿Qué debo comprar esta semana?', consent: true });

      expect(result.notice).toBe(UNAVAILABLE_MESSAGE);
      expect(result.providerUsed).toBe(false);
    });
  });
});
