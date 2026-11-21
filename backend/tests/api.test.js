'use strict';

const request = require('supertest');
const app = require('../src/app');
const { query, runAsSystem } = require('../src/config/database');
const { nextCode } = require('./helpers');

const TEST_CREDENTIALS = Boolean(
  process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD
  && process.env.TEST_CONSULTA_EMAIL && process.env.TEST_CONSULTA_PASSWORD,
);
const describeDatabase = process.env.DATABASE_URL && TEST_CREDENTIALS
  ? describe
  : describe.skip;

let adminToken;
let consultaToken;
let productId;
let createdCode;

async function login(email, password) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return response;
}

if (process.env.DATABASE_URL) {
  beforeAll(async () => {
    const admin = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
    expect(admin.status).toBe(200);
    adminToken = admin.body.data.token;

    const consulta = await login(process.env.TEST_CONSULTA_EMAIL, process.env.TEST_CONSULTA_PASSWORD);
    expect(consulta.status).toBe(200);
    consultaToken = consulta.body.data.token;
  });

  afterAll(async () => {
    if (productId) {
      await runAsSystem(() => query(
        'DELETE FROM inventory_movements WHERE product_id = $1', [productId],
      ));
      await runAsSystem(() => query(
        'DELETE FROM product_alert_settings WHERE product_id = $1', [productId],
      ));
      await runAsSystem(() => query('DELETE FROM products WHERE id = $1', [productId]));
    }
  });
}

describeDatabase('API REST de STOCKALERT', () => {
  it('expone health check con base de datos conectada', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.database).toBe('connected');
  });

  it('rechaza credenciales incorrectas', async () => {
    const response = await login(process.env.TEST_ADMIN_EMAIL, 'contraseña-erronea');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('protege las rutas privadas', async () => {
    const response = await request(app).get('/api/products');
    expect(response.status).toBe(401);
  });

  it('aplica permisos por rol en el backend', async () => {
    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${consultaToken}`)
      .send({ code: nextCode('DEN'), name: 'No permitido', purchasePrice: 1, salePrice: 2 });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('valida los datos de entrada con Zod', async () => {
    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: '', name: 'A' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('crea un producto con existencia inicial cero', async () => {
    createdCode = nextCode('API');
    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: createdCode,
        name: 'Producto integración API',
        minStock: 5,
        purchasePrice: 100,
        salePrice: 150,
        alertPercentage: 25,
      });
    expect(response.status).toBe(201);
    expect(response.body.data.code).toBe(createdCode);
    expect(Number(response.body.data.quantity)).toBe(0);
    expect(response.body.data.alert_level).toBe('AGOTADO');
    productId = response.body.data.id;
  });

  it('registra entradas con stock anterior y resultante', async () => {
    const response = await request(app)
      .post('/api/movements/in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, quantity: 10, notes: 'Entrada de prueba' });
    expect(response.status).toBe(201);
    expect(Number(response.body.data.movement.stock_before)).toBe(0);
    expect(Number(response.body.data.movement.stock_after)).toBe(10);
    expect(Number(response.body.data.product.quantity)).toBe(10);
  });

  it('registra salidas y evita stock negativo', async () => {
    const ok = await request(app)
      .post('/api/movements/out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, quantity: 3, reason: 'Salida de prueba' });
    expect(ok.status).toBe(201);
    expect(Number(ok.body.data.product.quantity)).toBe(7);

    const overflow = await request(app)
      .post('/api/movements/out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, quantity: 9999, reason: 'Excede existencias' });
    expect(overflow.status).toBe(409);
    expect(overflow.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('conserva el historial de movimientos', async () => {
    const response = await request(app)
      .get(`/api/products/${productId}/movements`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  it('devuelve resumen de alertas consistente', async () => {
    const response = await request(app)
      .get('/api/alerts/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    const { active_products, normal, low, critical, out_of_stock, attention } = response.body.data;
    expect(normal + low + critical + out_of_stock).toBe(active_products);
    expect(attention).toBe(low + critical + out_of_stock);
  });

  it('devuelve series diarias e indicadores reales', async () => {
    const dashboard = await request(app)
      .get('/api/dashboard?days=30')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.series).toHaveLength(30);

    const indicators = await request(app)
      .get('/api/indicators/summary?days=30')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(indicators.status).toBe(200);
    expect(indicators.body.data.window_days).toBe(30);
    expect(indicators.body.data).toHaveProperty('coverage_days');
  });

  it('expone el asistente IA con datos reales', async () => {
    const response = await request(app)
      .get('/api/ia/insights?days=30&leadTimeDays=14')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.summary).toHaveProperty('analyzedProducts');
    expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    expect(response.body.data.parameters.leadTimeDays).toBe(14);
  });

  it('expone el estado del copiloto sin secretos', async () => {
    const status = await request(app)
      .get('/api/ia/status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(status.status).toBe(200);
    expect(status.body.data).toHaveProperty('externalModelAvailable');
    expect(status.body.data).not.toHaveProperty('apiKey');
    expect(status.body.data).not.toHaveProperty('OPENROUTER_API_KEY');
  });

  it('nunca devuelve texto de chat generado por reglas locales', async () => {
    const question = 'Descuenta 5 unidades de arroz';
    const response = await request(app)
      .post('/api/ia/chat')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question, consent: false });
    expect(response.status).toBe(200);
    expect(response.body.data.providerUsed).toBe(false);
    expect(response.body.data.table ?? null).toBeNull();

    const data = response.body.data;
    if (data.outOfService) {
      expect(data.text).toContain('temporalmente fuera de servicio');
    } else {
      expect(data.consentRequired).toBe(true);
      expect(data.text).toBe('');
    }
    expect(data.text).not.toContain('No puedo modificar el inventario desde el chat');
  });

  it('genera reportes en JSON, CSV y PDF', async () => {
    const json = await request(app)
      .get('/api/reports/inventory?format=json')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(json.status).toBe(200);
    expect(json.body.data.columns.length).toBeGreaterThan(0);
    expect(json.body.data.rows.length).toBeGreaterThan(0);
    expect(Array.isArray(json.body.data.summary)).toBe(true);
    expect(json.body.data.summary.length).toBeGreaterThan(0);

    const csv = await request(app)
      .get('/api/reports/inventory?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);

    const pdf = await request(app)
      .get('/api/reports/valuation?format=pdf')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.body.length).toBeGreaterThan(3000);
  });

  it('cierra la sesión y revoca el token', async () => {
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(logout.status).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('UNAUTHORIZED');
  });
});
