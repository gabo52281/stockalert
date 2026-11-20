'use strict';

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

describeDatabase('indicadores de cobertura', () => {
  it('calcula promedio diario y cobertura con historial suficiente', async () => {
    const product = await track({ minStock: 5 });
    await move(product.id, 'IN', 100, 25);
    await move(product.id, 'OUT', 10, 20);
    await move(product.id, 'OUT', 10, 6);

    const result = await view(product.id);
    expect(Number(result.quantity)).toBe(80);
    expect(Number(result.out_units_window)).toBe(20);
    expect(Number(result.avg_daily_out)).toBeCloseTo(20 / 30, 2);
    expect(result.coverage_status).toBe('CALCULABLE');
    expect(Number(result.coverage_days)).toBe(120);
  });

  it('marca INSUFICIENTE cuando el historial es menor a los dias minimos', async () => {
    const product = await track({ minStock: 5 });
    await move(product.id, 'IN', 50, 10);
    await move(product.id, 'OUT', 5, 1);

    const result = await view(product.id);
    expect(result.coverage_status).toBe('INSUFICIENTE');
    expect(result.coverage_days).toBeNull();
  });

  it('marca NO_CALCULABLE cuando no hay salidas en la ventana', async () => {
    const product = await track({ minStock: 5 });
    await move(product.id, 'IN', 40, 15);

    const result = await view(product.id);
    expect(Number(result.out_units_window)).toBe(0);
    expect(result.coverage_status).toBe('NO_CALCULABLE');
    expect(result.coverage_days).toBeNull();
  });

  it('calcula el valor del inventario con precios reales', async () => {
    const product = await track({ minStock: 5, purchasePrice: 100, salePrice: 150 });
    await move(product.id, 'IN', 8);

    const result = await view(product.id);
    expect(Number(result.inventory_value)).toBe(800);
    expect(Number(result.inventory_sale_value)).toBe(1200);
  });
});
