'use strict';

const env = require('../src/config/env');
const repository = require('../src/repositories/ai.repository');
const {
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

describe('asistente IA de STOCKALERT con OpenAI', () => {
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

    it('prepara cifras reales para el asistente con formato colombiano', () => {
      const context = buildContext(facts);
      expect(context).toContain('$ 510.000');
      expect(context).toContain('Arroz integral');
      expect(context).toContain('28');
      expect(context).toContain('Productos activos del establecimiento');
    });
  });

  it('expone el estado del asistente sin secretos', () => {
    const current = status();
    expect(['ia', 'unavailable']).toContain(current.mode);
    expect(current).not.toHaveProperty('apiKey');
    expect(current).not.toHaveProperty('OPENAI_API_KEY');
    expect(current).not.toHaveProperty('OPENROUTER_API_KEY');
    expect(current.externalModelAvailable).toBe(Boolean(env.OPENAI_API_KEY));
    if (current.model) expect(current.model).toBe(env.OPENAI_MODEL);
  });

  describe('llamada a OpenAI (simulada en pruebas)', () => {
    const original = {
      key: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      fetch: global.fetch,
      loadInventorySignals: repository.loadInventorySignals,
      loadMovementTotals: repository.loadMovementTotals,
    };

    beforeEach(() => {
      env.OPENAI_API_KEY = 'clave-de-prueba';
      env.OPENAI_MODEL = 'gpt-5.6-luna';
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
      env.OPENAI_API_KEY = original.key;
      env.OPENAI_MODEL = original.model;
      global.fetch = original.fetch;
      repository.loadInventorySignals = original.loadInventorySignals;
      repository.loadMovementTotals = original.loadMovementTotals;
    });

    it('sin clave no contacta al proveedor y reporta el servicio fuera de línea', async () => {
      let called = false;
      global.fetch = async () => { called = true; throw new Error('No debió llamarse'); };
      env.OPENAI_API_KEY = '';

      const result = await answer({ question: '¿Qué debo comprar esta semana?' });

      expect(called).toBe(false);
      expect(result.outOfService).toBe(true);
      expect(result.text).toBe(UNAVAILABLE_MESSAGE);
      expect(result.providerUsed).toBe(false);
    });

    it('responde sin pedir consentimiento ni mostrar texto local', async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-5.6-luna',
          choices: [{ message: { content: 'Repón 15 unidades de arroz integral.' } }],
        }),
      });

      const result = await answer({ question: '¿Qué debo comprar esta semana?' });

      expect(result.providerUsed).toBe(true);
      expect(result.mode).toBe('ia');
      expect(result.consentRequired).toBe(false);
      expect(result.outOfService).toBe(false);
      expect(result.text).toBe('Repón 15 unidades de arroz integral.');
    });

    it.each([
      ['cuota o clave inválida', () => ({
        ok: false, status: 429, json: async () => ({ error: { code: 'RATE_LIMIT_EXCEEDED' } }),
      }), 'quota'],
      ['créditos insuficientes', () => ({
        ok: false, status: 402, json: async () => ({ error: { code: 'INSUFFICIENT_QUOTA' } }),
      }), 'quota'],
      ['tiempo de espera agotado', () => {
        const error = new Error('Abortada por timeout');
        error.name = 'AbortError';
        throw error;
      }, 'timeout'],
      ['error del proveedor', () => ({
        ok: false, status: 500, json: async () => ({ error: { message: 'Error interno' } }),
      }), 'provider'],
    ])('con %s devuelve el mensaje del asistente fuera de servicio', async (_name, fetchMock, reason) => {
      global.fetch = fetchMock;

      const result = await answer({ question: '¿Qué debo comprar esta semana?' });

      expect(result.outOfService).toBe(true);
      expect(result.text).toBe(UNAVAILABLE_MESSAGE);
      expect(result.mode).toBe('unavailable');
      expect(result.providerUsed).toBe(false);
      expect(result.error).toBe(reason);
    });

    it('envía el contexto real a OpenAI y sanitiza cualquier clave devuelta', async () => {
      let url;
      let authorization;
      let body;
      global.fetch = async (target, init) => {
        url = target;
        authorization = init.headers.Authorization;
        body = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: 'gpt-5.6-luna',
            choices: [{ message: { content: 'Repón 40 unidades. Nunca compartas sk-proj-abc123def456ghi789.' } }],
          }),
        };
      };

      const result = await answer({
        question: '¿Qué debo comprar esta semana?',
        history: [{ role: 'user', content: 'Hola' }],
      });

      expect(result.providerUsed).toBe(true);
      expect(result.table).toBeNull();
      expect(result.text).toContain('Repón 40 unidades');
      expect(result.text).not.toContain('sk-proj-abc123def456ghi789');
      expect(result.text).toContain('[CLAVE OCULTA]');
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(authorization).toBe('Bearer clave-de-prueba');
      expect(body.model).toBe('gpt-5.6-luna');
      expect(body.max_completion_tokens).toBeGreaterThan(0);
      expect(body.temperature).toBeUndefined();
      expect(body.reasoning).toBeUndefined();
      expect(body.provider).toBeUndefined();
      expect(body.messages[0].content).toContain('analista senior de operaciones e inventarios');
      expect(body.messages[0].content).toContain('Nunca uses Markdown');
      expect(body.messages[0].content).toContain('prohibido inventar, estimar');
      expect(body.messages.at(-2).content).toBe('Hola');
      expect(body.messages.at(-1).content).toContain('DATOS VERIFICADOS DEL ESTABLECIMIENTO');
      expect(body.messages.at(-1).content).toContain('Módulos: productos, categorías');
    });

    it('elimina Markdown y negritas aunque el modelo los devuelva', async () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-5.6-luna',
          choices: [{
            message: {
              content: '### Conclusión breve\nRepón **Jabón de tocador**.\n- Revisa el stock\nVer [alertas](https://ejemplo.com).',
            },
          }],
        }),
      });

      const result = await answer({ question: '¿Qué debo comprar esta semana?' });

      expect(result.text).not.toContain('###');
      expect(result.text).not.toContain('**');
      expect(result.text).not.toContain('- Revisa');
      expect(result.text).not.toContain('[alertas]');
      expect(result.text).toContain('Conclusión breve');
      expect(result.text).toContain('Repón Jabón de tocador');
      expect(result.text).toContain('Ver alertas');
    });

    it('reintenta una sola vez cuando la primera respuesta viene vacía', async () => {
      const calls = [];
      global.fetch = async (_url, init) => {
        const sent = JSON.parse(init.body);
        calls.push(sent.max_completion_tokens);
        return {
          ok: true,
          status: 200,
          json: async () => (calls.length === 1
            ? { model: 'gpt-5.6-luna', choices: [{ message: { content: '' } }] }
            : { model: 'gpt-5.6-luna', choices: [{ message: { content: 'Repón 10 unidades.' } }] }),
        };
      };

      const result = await answer({ question: '¿Qué debo comprar esta semana?' });

      expect(calls).toHaveLength(2);
      expect(calls[1]).toBeGreaterThan(calls[0]);
      expect(result.providerUsed).toBe(true);
      expect(result.text).toBe('Repón 10 unidades.');
    });
  });
});
