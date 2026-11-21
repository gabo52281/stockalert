'use strict';

const { query, runAsSystem } = require('../src/config/database');
const { createProduct, move, view, cleanup } = require('./helpers');

const describeDatabase = process.env.DATABASE_URL ? describe : describe.skip;

const created = [];
const track = async (options) => {
  const product = await createProduct(options);
  created.push(product.id);
  return product;
};

if (process.env.DATABASE_URL) {
  afterAll(async () => {
    await cleanup(created);
  });
}

describeDatabase('motor de alertas (v_product_inventory)', () => {
  it('clasifica AGOTADO cuando el stock es cero', async () => {
    const product = await track({ minStock: 10 });
    const result = await view(product.id);
    expect(Number(result.quantity)).toBe(0);
    expect(result.alert_level).toBe('AGOTADO');
  });

  it('clasifica CRITICO cuando 0 < stock <= minimo', async () => {
    const product = await track({ minStock: 10 });
    await move(product.id, 'IN', 10);
    const result = await view(product.id);
    expect(Number(result.quantity)).toBe(10);
    expect(result.alert_level).toBe('CRITICO');
  });

  it('clasifica BAJO entre el minimo y el umbral preventivo', async () => {
    const product = await track({ minStock: 10, alertPercentage: 25 });
    await move(product.id, 'IN', 11);
    const result = await view(product.id);
    expect(Number(result.quantity)).toBe(11);
    expect(Number(result.preventive_threshold)).toBe(12.5);
    expect(result.alert_level).toBe('BAJO');
  });

  it('clasifica NORMAL por encima del umbral preventivo', async () => {
    const product = await track({ minStock: 10, alertPercentage: 25 });
    await move(product.id, 'IN', 13);
    const result = await view(product.id);
    expect(Number(result.quantity)).toBe(13);
    expect(result.alert_level).toBe('NORMAL');
  });

  it('un minimo cero con stock positivo siempre es NORMAL', async () => {
    const product = await track({ minStock: 0, alertPercentage: 25 });
    await move(product.id, 'IN', 1);
    const result = await view(product.id);
    expect(Number(result.min_stock)).toBe(0);
    expect(result.alert_level).toBe('NORMAL');
  });

  it('respeta un porcentaje preventivo configurado por producto', async () => {
    const product = await track({ minStock: 10, alertPercentage: 10 });
    await setPreventivePercentage(product.id, 50);
    await move(product.id, 'IN', 14);
    const result = await view(product.id);
    expect(Number(result.effective_percentage)).toBe(50);
    expect(Number(result.preventive_threshold)).toBe(15);
    expect(result.alert_level).toBe('BAJO');
  });
});

async function setPreventivePercentage(productId, percentage) {
  await runAsSystem(() => query(
    `INSERT INTO product_alert_settings (product_id, preventive_percentage, analysis_window_days, min_history_days)
     VALUES ($1,$2,30,7)`,
    [productId, percentage],
  ), 1);
}
