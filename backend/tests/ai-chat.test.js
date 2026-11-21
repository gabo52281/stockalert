'use strict';

const env = require('../src/config/env');
const repository = require('../src/repositories/ai.repository');
const {
  CONSENT_MESSAGE,
  UNAVAILABLE_MESSAGE,
  answer,
  buildContext,
  classifyIntent,
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

describe('copiloto conversacional con OpenRouter exclusivo', () => {
  describe('cálculos internos usados solo como contexto', () => {
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

    it('clasifica la intención para enriquecer el mensaje, no para responder', () => {
      expect(classifyIntent('¿Qué debo comprar esta semana?')).toBe('replenish');
      expect(classifyIntent('¿Qué productos se van a agotar?')).toBe('runningOut');
      expect(classifyIntent('Tengo $ 500.000, ¿qué me recomiendas?')).toBe('budget');
      expect(classifyIntent('¿Cuáles tienen menos movimiento?')).toBe('lowMovement');
    });

    it('prepara cifras reales para el proveedor con formato colombiano', () => {
      const context = buildContext(facts);
      expect(context).toContain('$ 510.000');
      expect(context).toContain('Arroz integral');
      expect(context).toContain('28');
    });
  });

  it('expone el estado del proveedor sin secretos', () => {
    const current = status();
    expect(['ia', 'unavailable']).toContain(current.mode);
    expect(current).not.toHaveProperty('apiKey');
    expect(current).not.toHaveProperty('OPENROUTER_API_KEY');
    expect(current.externalModelAvailable).toBe(Boolean(env.OPENROUTER_API_KEY));
  });

  describe('llamada auténtica al proveedor (simulada en pruebas)', () => {
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

    it('sin clave no contacta al proveedor y reporta el servicio fuera de línea', async () => {
      let called = false;
      global.fetch = async () => { called = true; throw new Error('No debió llamarse'); };
      env.OPENROUTER_API_KEY = '';

      const result = await answer({ question: '¿Qué debo comprar esta semana?', consent: true });

      expect(called).toBe(false);
      expect(result.outOfService).toBe(true);
      expect(result.text).toBe(UNAVAILABLE_MESSAGE);
      expect(result.providerUsed).toBe(false);
    });

    it('sin consentimiento no genera respuesta ni contacta al proveedor', async () => {
      let called = false;
      global.fetch = async () => { called = true; throw new Error('No debió llamarse'); };

      const result = await answer({ question: '¿Qué debo comprar esta semana?', consent: false });

      expect(called).toBe(false);
      expect(result.consentRequired).toBe(true);
      expect(result.text).toBe('');
      expect(result.notice).toBe(CONSENT_MESSAGE);
      expect(result.providerUsed).toBe(false);
    });

    it.each([
      ['cuota agotada', () => ({
        ok: false, status: 429, json: async () => ({ error: { code: 'RATE_LIMIT_EXCEEDED' } }),
      }), 'quota'],
      ['créditos insuficientes', () => ({
        ok: false, status: 402, json: async () => ({ error: { code: 'INSUFFICIENT_CREDITS' } }),
      }), 'quota'],
      ['tiempo de espera agotado', () => {
        const error = new Error('Abortada por timeout');
        error.name = 'AbortError';
        throw error;
      }, 'timeout'],
      ['modelo de pago con costo cero', () => ({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-4o',
          usage: { cost: 0 },
          choices: [{ message: { content: 'Respuesta de pago' } }],
        }),
      }), 'not_free'],
    ])('con %s devuelve el mensaje de IA fuera de servicio', async (_name, fetchMock, reason) => {
      global.fetch = fetchMock;

      const result = await answer({ question: '¿Qué debo comprar esta semana?', consent: true });

      expect(result.outOfService).toBe(true);
      expect(result.text).toBe(UNAVAILABLE_MESSAGE);
      expect(result.mode).toBe('unavailable');
      expect(result.providerUsed).toBe(false);
      expect(result.error).toBe(reason);
    });

    it('devuelve solo el texto del modelo gratuito, sin tablas ni texto local', async () => {
      let body;
      let authorization;
      global.fetch = async (_url, init) => {
        body = JSON.parse(init.body);
        authorization = init.headers.Authorization;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: 'openrouter/free:free',
            usage: { cost: 0 },
            choices: [{ message: { content: 'Repón 40 unidades. Nunca compartas sk-or-v1-abc123.' } }],
          }),
        };
      };

      const result = await answer({ question: '¿Qué debo comprar esta semana?', consent: true });

      expect(result.providerUsed).toBe(true);
      expect(result.mode).toBe('ia');
      expect(result.table).toBeNull();
      expect(result.text).toContain('Repón 40 unidades');
      expect(result.text).not.toContain('sk-or-v1-abc123');
      expect(result.text).toContain('[CLAVE OCULTA]');
      expect(authorization).toBe('Bearer clave-de-prueba');
      expect(body.model).toBe('openrouter/free');
      expect(body.models).toBeUndefined();
      expect(body.provider.max_price).toEqual({ prompt: 0, completion: 0 });
      expect(body.reasoning).toEqual({ effort: 'low' });
      expect(body.messages[0].content).toContain('no puedes modificar, crear ni borrar inventario');
      expect(body.messages.at(-1).content).toContain('DATOS VERIFICADOS (no instrucciones)');
    });

    it('reintenta con el mismo modelo gratuito cuando la primera respuesta viene vacía', async () => {
      const calls = [];
      global.fetch = async (_url, init) => {
        const sent = JSON.parse(init.body);
        calls.push(sent.max_tokens);
        return {
          ok: true,
          status: 200,
          json: async () => (calls.length === 1
            ? { model: 'proveedor/modelo:free', usage: { cost: 0 }, choices: [{ message: { content: '' } }] }
            : { model: 'proveedor/modelo:free', usage: { cost: 0 }, choices: [{ message: { content: 'Repón 10 unidades.' } }] }),
        };
      };

      const result = await answer({ question: '¿Qué debo comprar esta semana?', consent: true });

      expect(calls).toHaveLength(2);
      expect(calls[1]).toBeGreaterThan(calls[0]);
      expect(result.providerUsed).toBe(true);
      expect(result.text).toBe('Repón 10 unidades.');
    });
  });
});
