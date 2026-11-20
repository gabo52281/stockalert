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
  let alertRequests = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/alerts/summary')) alertRequests += 1;
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('usuario@empresa.com').fill('admin@stockalert.local');
  await page.locator('input[autocomplete="current-password"]').fill('Demo1234!');
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });

  await page.getByRole('link', { name: 'Movimientos' }).click();
  await page.locator('.tabs button').first().waitFor({ timeout: 15000 });

  const tabs = page.locator('.tabs button');
  const tab = (name) => tabs.filter({ hasText: name });
  const entryHeading = page.getByRole('heading', { name: 'Nueva entrada' });
  const exitHeading = page.getByRole('heading', { name: 'Nueva salida' });
  const historyTable = page.locator('.data-table');
  const typeFilter = page.locator('.filters-bar select').nth(0);
  const productFilter = page.locator('.filters-bar select').nth(1);

  // 1. Entrada: solo el formulario de entrada y pestaña azul activa.
  await tab('Registrar entrada').click();
  await entryHeading.waitFor();
  assert.equal(await exitHeading.count(), 0, 'No debe aparecer Nueva salida');
  assert.equal(await historyTable.count(), 0, 'No debe aparecer el historial');
  assert.match(await tab('Registrar entrada').getAttribute('class'), /active/);
  assert.equal(await page.locator('.movement-form .card').count(), 1);
  console.log('1. Registrar entrada muestra únicamente Nueva entrada');

  // 2. Salida: solo el formulario de salida.
  await tab('Registrar salida').click();
  await exitHeading.waitFor();
  assert.equal(await entryHeading.count(), 0, 'No debe aparecer Nueva entrada');
  assert.equal(await historyTable.count(), 0, 'No debe aparecer el historial');
  assert.match(await tab('Registrar salida').getAttribute('class'), /active/);
  assert.equal(await page.locator('.movement-form .card').count(), 1);
  console.log('2. Registrar salida muestra únicamente Nueva salida');

  // 3. Historial: solo filtros, tabla y paginación.
  await tab('Historial').click();
  await historyTable.waitFor();
  assert.equal(await entryHeading.count(), 0);
  assert.equal(await exitHeading.count(), 0);
  assert.equal(await page.locator('.filters-bar').count(), 1);
  const historyRows = await page.locator('.data-table tbody tr').count();
  assert.equal(await page.locator('.pagination').count(), historyRows ? 1 : 0);
  assert.match(await tab('Historial').getAttribute('class'), /active/);
  console.log('3. Historial muestra únicamente filtros, tabla y paginación');

  // 4. Cambios repetidos entre pestañas.
  await tab('Registrar entrada').click();
  await entryHeading.waitFor();
  assert.equal(await exitHeading.count(), 0);
  await tab('Registrar salida').click();
  await exitHeading.waitFor();
  assert.equal(await entryHeading.count(), 0);
  await tab('Registrar entrada').click();
  await entryHeading.waitFor();
  assert.equal(await exitHeading.count(), 0);
  console.log('4. Entrada → Salida → Entrada funciona sin estados residuales');

  // Producto y cantidades en el formulario de entrada.
  const entryCard = page.locator('.card').filter({ has: entryHeading });
  const productSelect = entryCard.locator('select').first();
  await productSelect.selectOption({ index: 1 });
  const optionText = (await productSelect.locator('option').nth(1).textContent()).trim();
  const productCode = optionText.split(' · ')[0].trim();
  const productName = optionText.split(' · ')[1].trim();
  const stockText = await entryCard.locator('.info-box').innerText();
  const initialStock = Number(stockText.match(/([\d.,]+)\s*unidades/)[1].replace(/\./g, ''));
  assert.ok(Number.isInteger(initialStock));

  const entryQuantity = entryCard.locator('input[inputmode="numeric"]');
  await entryQuantity.click();
  await entryQuantity.press('ControlOrMeta+A');
  await entryQuantity.press('Backspace');
  assert.equal(await entryQuantity.inputValue(), '', 'La cantidad debe poder borrarse');
  await entryQuantity.pressSequentially('7');
  assert.equal(await entryQuantity.inputValue(), '7');
  console.log('5. Productos seleccionables y cantidades editables/borrables');

  // Historial filtrado para contar los registros antes de cada movimiento.
  await tab('Historial').click();
  await historyTable.waitFor();
  await typeFilter.selectOption('IN');
  await productFilter.selectOption({ label: productName });
  await page.waitForTimeout(400);

  // 6. Registrar entrada: stock y alertas.
  await tab('Registrar entrada').click();
  await entryHeading.waitFor();
  await entryCard.locator('select').first().selectOption({ label: optionText });
  const quantityAfterSwitch = entryCard.locator('input[inputmode="numeric"]');
  await quantityAfterSwitch.fill('7');
  const alertsBeforeEntry = alertRequests;
  await entryCard.getByRole('button', { name: 'Registrar entrada' }).click();
  await page.getByText(/Entrada registrada/).waitFor({ timeout: 15000 });
  const entryToast = await page.locator('.toast').last().innerText();
  const entryStock = Number(entryToast.match(/Stock resultante:\s*([\d.,]+)\s*unidades/)[1].replace(/\./g, ''));
  assert.equal(entryStock, initialStock + 7, 'La entrada debe aumentar el stock en 7');
  await page.waitForTimeout(400);
  assert.ok(alertRequests > alertsBeforeEntry, 'Las alertas deben actualizarse tras la entrada');
  console.log('6. Entrada registrada: stock aumentado y alertas actualizadas');

  await tab('Historial').click();
  await historyTable.waitFor();
  await page.waitForTimeout(400);
  const entryRow = page.locator('.data-table tbody tr').filter({ hasText: productCode }).filter({ hasText: '7' }).first();
  await entryRow.waitFor({ timeout: 15000 });
  assert.match(await entryRow.innerText(), /Entrada/);
  console.log('7. La entrada aparece en el historial');

  // 8. Registrar salida con el mismo producto y cantidad compensatoria.
  await tab('Registrar salida').click();
  const exitHeadingLocator = page.getByRole('heading', { name: 'Nueva salida' });
  await exitHeadingLocator.waitFor();
  const exitCard = page.locator('.card').filter({ has: exitHeadingLocator });
  await exitCard.locator('select').first().selectOption({ label: optionText });
  await exitCard.locator('input[inputmode="numeric"]').fill('7');
  await exitCard.locator('input[placeholder^="Ej. Venta"]').fill('Prueba E2E pestañas');

  await tab('Historial').click();
  await historyTable.waitFor();
  await typeFilter.selectOption('OUT');
  await productFilter.selectOption({ label: productName });
  await page.waitForTimeout(400);

  await tab('Registrar salida').click();
  await exitHeadingLocator.waitFor();
  const alertsBeforeExit = alertRequests;
  await exitCard.getByRole('button', { name: 'Registrar salida' }).click();
  await page.getByText(/Salida registrada/).waitFor({ timeout: 15000 });
  const exitToast = await page.locator('.toast').last().innerText();
  const exitStock = Number(exitToast.match(/Stock resultante:\s*([\d.,]+)\s*unidades/)[1].replace(/\./g, ''));
  assert.equal(exitStock, initialStock, 'La salida debe devolver el stock a su valor original');
  await page.waitForTimeout(400);
  assert.ok(alertRequests > alertsBeforeExit, 'Las alertas deben actualizarse tras la salida');
  console.log('8. Salida registrada: stock descontado y alertas actualizadas');

  await tab('Historial').click();
  await historyTable.waitFor();
  await page.waitForTimeout(400);
  const exitRow = page.locator('.data-table tbody tr').filter({ hasText: 'Prueba E2E pestañas' }).first();
  await exitRow.waitFor({ timeout: 15000 });
  assert.match(await exitRow.innerText(), /Salida/);
  assert.match(await exitRow.innerText(), /\b7\b/);
  console.log('9. La salida aparece en el historial');

  // 10. Responsive y consola limpia.
  await tab('Registrar entrada').click();
  await entryHeading.waitFor();
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await entryHeading.isVisible(), `El formulario debe verse a ${width} px`);
    assert.equal(await exitHeading.count(), 0);
    assert.equal(await page.locator('.movement-form .card').count(), 1);
  }
  assert.deepEqual(errors, [], `Errores de JavaScript: ${errors.join(' | ')}`);
  console.log('10. Diseño responsive conservado y sin errores de JavaScript');

  console.log('\nE2E de pestañas: 10 comprobaciones superadas.');
} finally {
  await browser.close();
}
