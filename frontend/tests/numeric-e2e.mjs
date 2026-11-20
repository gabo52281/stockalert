import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--no-sandbox'],
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('usuario@empresa.com').fill('admin@stockalert.local');
  await page.locator('input[autocomplete="current-password"]').fill('Demo1234!');
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  // Formulario de productos: edición real sin guardar cambios.
  await page.getByRole('link', { name: 'Productos' }).click();
  await page.locator('.data-table tbody tr').first().waitFor({ timeout: 15000 });
  await page.locator('button[title="Editar"]').first().click();
  await page.locator('#product-form').waitFor();

  const purchase = page.locator('#product-form .field')
    .filter({ hasText: 'Precio de compra (COP)' }).locator('input');
  const initialPrice = await purchase.inputValue();
  assert.match(initialPrice, /^\$\s[\d.]+$/, 'El precio existente debe mostrarse en COP');
  assert.ok(!initialPrice.includes(','), 'No deben aparecer separadores de miles con coma');

  await purchase.fill('');
  assert.equal(await purchase.inputValue(), '', 'El campo debe poder borrarse por completo');

  await purchase.fill('1250000');
  assert.equal(await purchase.inputValue(), '$ 1.250.000');

  await purchase.fill('1500000.00');
  assert.equal(await purchase.inputValue(), '$ 1.250.000', 'No deben aceptarse decimales monetarios');

  await purchase.fill('$ 2.500.000');
  assert.equal(await purchase.inputValue(), '$ 2.500.000', 'Debe aceptarse un valor pegado con formato');

  await purchase.fill('');
  assert.equal(await purchase.inputValue(), '');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  console.log('1. Precios COP editables, formateo en vivo, borrado y decimales rechazados');

  // Movimientos: scroll, decimales y negativos sin registrar la operación.
  await page.getByRole('link', { name: 'Movimientos' }).click();
  await page.getByText('Registrar entrada').first().waitFor();
  const quantity = page.locator('input[inputmode="numeric"]').first();
  assert.equal(await quantity.inputValue(), '1');

  await page.setViewportSize({ width: 900, height: 600 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await quantity.hover();
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(150);
  assert.equal(await quantity.inputValue(), '1', 'La rueda del ratón no debe cambiar la cantidad');
  assert.ok(await page.evaluate(() => window.scrollY) > 0, 'La página debe seguir desplazándose');
  console.log('2. La rueda del ratón desplaza la página sin modificar cantidades');

  await quantity.fill('1.5');
  assert.equal(await quantity.inputValue(), '1', 'No deben aceptarse cantidades decimales');
  await quantity.fill('-5');
  assert.equal(await quantity.inputValue(), '1', 'No deben aceptarse cantidades negativas');
  await quantity.fill('');
  assert.equal(await quantity.inputValue(), '', 'El campo debe poder borrarse por completo');
  await quantity.fill('15');
  assert.equal(await quantity.inputValue(), '15');
  console.log('3. Cantidades enteras, sin decimales ni negativos');

  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await quantity.isVisible(), 'El campo debe permanecer visible en móvil');
  console.log('4. Campos numéricos visibles y operativos en 390 px');

  assert.deepEqual(errors, [], `Errores de JavaScript: ${errors.join(' | ')}`);
  console.log('\nE2E numérico: 4 comprobaciones superadas, sin errores de JavaScript.');
} finally {
  await browser.close();
}
