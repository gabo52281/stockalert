import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const HOME_PATH = process.env.E2E_HOME_PATH || '/';

if (!EMAIL || !PASSWORD) {
  console.error('Defina E2E_EMAIL y E2E_PASSWORD antes de ejecutar las pruebas E2E.');
  process.exit(1);
}

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--no-sandbox'],
});

async function paste(locator, text) {
  await locator.press('ControlOrMeta+A');
  await pageEvaluateClipboard(text);
  await locator.press('ControlOrMeta+V');
}

let clipboardPage;

async function pageEvaluateClipboard(text) {
  await clipboardPage.evaluate((value) => navigator.clipboard.writeText(value), text);
}

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  clipboardPage = page;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('usuario@empresa.com').fill(EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await page.waitForURL((url) => url.pathname === HOME_PATH, { timeout: 15000 });

  // -------------------------------------------------------------------------
  // Edición real de un producto existente (sin guardar cambios).
  // -------------------------------------------------------------------------
  await page.getByRole('link', { name: 'Productos' }).click();
  await page.locator('.data-table tbody tr').first().waitFor({ timeout: 15000 });
  await page.locator('button[title="Editar"]').first().click();
  await page.locator('#product-form').waitFor();

  const form = page.locator('#product-form');
  const field = (label) => form.locator('.field').filter({ hasText: label }).locator('input');
  const purchase = field('Precio de compra (COP)');
  const minStock = field('Stock mínimo');

  const initialPrice = await purchase.inputValue();
  assert.match(initialPrice, /^\$\s[\d.]+$/, 'El precio existente debe mostrarse en COP');
  assert.ok(!initialPrice.includes(','), 'No deben aparecer separadores de miles con coma');

  // 1. Seleccionar todo y Backspace.
  await purchase.click();
  await purchase.press('ControlOrMeta+A');
  await purchase.press('Backspace');
  assert.equal(await purchase.inputValue(), '', 'Ctrl+A + Backspace debe vaciar el precio');

  // 2. Seleccionar todo y Delete.
  await purchase.fill('1250000');
  assert.equal(await purchase.inputValue(), '$ 1.250.000');
  await purchase.press('ControlOrMeta+A');
  await purchase.press('Delete');
  assert.equal(await purchase.inputValue(), '', 'Ctrl+A + Delete debe vaciar el precio');
  console.log('1. Ctrl+A + Backspace y Ctrl+A + Delete dejan el precio vacío');

  // 3. Borrar números uno por uno.
  await purchase.fill('50000');
  assert.equal(await purchase.inputValue(), '$ 50.000');
  for (let index = 0; index < 5; index += 1) await purchase.press('Backspace');
  assert.equal(await purchase.inputValue(), '', 'Borrar dígito por dígito debe dejar el campo vacío');

  // 4. Escribir después de dejar el campo vacío.
  await purchase.pressSequentially('50000');
  assert.equal(await purchase.inputValue(), '$ 50.000', 'Escribir sobre vacío debe formatear en vivo');
  console.log('2. Borrado dígito por dígito y escritura posterior: $ 50.000');

  // 5. Reemplazar un número existente.
  await purchase.press('ControlOrMeta+A');
  await purchase.pressSequentially('8');
  assert.equal(await purchase.inputValue(), '$ 8', 'Seleccionar todo y escribir debe reemplazar el valor');

  // 6. Borrar un dígito intermedio.
  await purchase.fill('1250000');
  assert.equal(await purchase.inputValue(), '$ 1.250.000');
  await purchase.press('Home');
  for (let index = 0; index < 6; index += 1) await purchase.press('ArrowRight');
  await purchase.press('Backspace');
  assert.equal(await purchase.inputValue(), '$ 120.000', 'Borrar en medio no debe restaurar el número');
  console.log('3. Reemplazo completo y borrado de dígitos intermedios sin restauración');

  // 7. Pegar números con y sin formato.
  await paste(purchase, '$ 2.500.000');
  assert.equal(await purchase.inputValue(), '$ 2.500.000', 'Debe aceptarse un valor pegado con formato COP');
  await paste(purchase, '75000');
  assert.equal(await purchase.inputValue(), '$ 75.000', 'Debe aceptarse un valor pegado sin formato');

  await purchase.fill('1500000.00');
  assert.equal(await purchase.inputValue(), '$ 75.000', 'No deben aceptarse decimales monetarios');
  await purchase.fill('-100');
  assert.equal(await purchase.inputValue(), '$ 75.000', 'No deben aceptarse negativos');
  console.log('4. Pegado con/sin formato, rechazo de decimales y negativos');

  // 8. Cantidades: mismo comportamiento en un producto existente.
  await minStock.click();
  await minStock.press('ControlOrMeta+A');
  await minStock.press('Backspace');
  assert.equal(await minStock.inputValue(), '', 'La cantidad debe poder borrarse por completo');
  await minStock.pressSequentially('25');
  assert.equal(await minStock.inputValue(), '25');
  await minStock.press('ControlOrMeta+A');
  await minStock.press('Delete');
  assert.equal(await minStock.inputValue(), '', 'Delete también debe vaciar la cantidad');
  await minStock.pressSequentially('8');
  assert.equal(await minStock.inputValue(), '8');
  await minStock.fill('1.5');
  assert.equal(await minStock.inputValue(), '8', 'No deben aceptarse cantidades decimales');
  await minStock.fill('-5');
  assert.equal(await minStock.inputValue(), '8', 'No deben aceptarse cantidades negativas');
  console.log('5. Cantidades: borrado total, reemplazo y rechazo de decimales/negativos');

  await page.getByRole('button', { name: 'Cancelar' }).click();

  // -------------------------------------------------------------------------
  // Movimientos: scroll y cantidades.
  // -------------------------------------------------------------------------
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

  await quantity.fill('1.5');
  assert.equal(await quantity.inputValue(), '1', 'No deben aceptarse cantidades decimales');
  await quantity.fill('-5');
  assert.equal(await quantity.inputValue(), '1', 'No deben aceptarse cantidades negativas');
  await quantity.click();
  await quantity.press('ControlOrMeta+A');
  await quantity.press('Backspace');
  assert.equal(await quantity.inputValue(), '', 'La cantidad debe quedar vacía al borrarla');
  await quantity.pressSequentially('15');
  assert.equal(await quantity.inputValue(), '15');
  console.log('6. La rueda desplaza la página sin cambiar cantidades y el borrado funciona');

  await page.setViewportSize({ width: 1440, height: 900 });

  // -------------------------------------------------------------------------
  // 9 y 10. Crear un producto con precios nuevos y verificar lo guardado.
  // -------------------------------------------------------------------------
  const code = `NUM-E2E-${Date.now()}`;
  await page.getByRole('link', { name: 'Productos' }).click();
  await page.locator('.data-table tbody tr').first().waitFor({ timeout: 15000 });

  // Limpieza de productos de pruebas anteriores.
  const search = page.getByPlaceholder('Buscar por nombre o código…');
  await search.fill('NUM-E2E-');
  await page.waitForTimeout(600);
  const leftovers = page.locator('.data-table tbody tr').filter({ hasText: 'NUM-E2E-' });
  while (await leftovers.count()) {
    await leftovers.first().locator('button[title="Eliminar"]').click();
    await page.locator('.modal__footer').getByRole('button', { name: 'Eliminar' }).click();
    await page.waitForTimeout(300);
  }
  await search.fill('');
  await page.waitForTimeout(600);

  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await page.locator('#product-form').waitFor();

  const createForm = page.locator('#product-form');
  const createField = (label) => createForm.locator('.field').filter({ hasText: label }).locator('input');
  await createField('Código único').fill(code);
  await createField('Nombre').fill('Producto verificación numérica');

  const newPurchase = createField('Precio de compra (COP)');
  const newSale = createField('Precio de venta (COP)');
  await newPurchase.press('ControlOrMeta+A');
  await newPurchase.press('Backspace');
  assert.equal(await newPurchase.inputValue(), '', 'El precio nuevo debe poder borrarse');
  await newPurchase.pressSequentially('1250000');
  assert.equal(await newPurchase.inputValue(), '$ 1.250.000');
  await newSale.fill('1500000');
  assert.equal(await newSale.inputValue(), '$ 1.500.000');

  const newMinStock = createField('Stock mínimo');
  await newMinStock.press('ControlOrMeta+A');
  await newMinStock.press('Backspace');
  await newMinStock.pressSequentially('10');
  assert.equal(await newMinStock.inputValue(), '10');

  await page.locator('.modal__footer').getByRole('button', { name: 'Crear producto' }).click();
  await page.locator('#product-form').waitFor({ state: 'detached', timeout: 15000 });

  await page.getByPlaceholder('Buscar por nombre o código…').fill(code);
  const createdRow = page.locator('.data-table tbody tr').filter({ hasText: code });
  await createdRow.waitFor({ timeout: 15000 });
  const rowText = await createdRow.innerText();
  assert.match(rowText, /\$\s1\.500\.000/, 'El precio guardado debe mostrarse en COP sin decimales');
  assert.match(rowText, /\b10\b/, 'El stock mínimo guardado debe mostrarse como entero');
  console.log('7. Producto creado con precios nuevos y valores guardados correctamente');

  // Reabrir para comprobar que el estado del formulario viene de la API.
  await createdRow.locator('button[title="Editar"]').click();
  await page.locator('#product-form').waitFor();
  const editForm = page.locator('#product-form');
  const editField = (label) => editForm.locator('.field').filter({ hasText: label }).locator('input');
  assert.equal(await editField('Precio de compra (COP)').inputValue(), '$ 1.250.000');
  assert.equal(await editField('Precio de venta (COP)').inputValue(), '$ 1.500.000');
  assert.equal(await editField('Stock mínimo').inputValue(), '10');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  console.log('8. Edición de producto existente carga y conserva los valores COP');

  // Limpieza del producto de prueba.
  await createdRow.locator('button[title="Eliminar"]').click();
  await page.locator('.modal__footer').getByRole('button', { name: 'Eliminar' }).click();
  await createdRow.waitFor({ state: 'detached', timeout: 15000 });
  console.log('9. Producto de prueba eliminado después de verificar la persistencia');

  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.getByRole('link', { name: 'Productos' }).isVisible(), 'El menú debe permanecer visible en móvil');
  console.log('10. Diseño responsive conservado en 390 px');

  assert.deepEqual(errors, [], `Errores de JavaScript: ${errors.join(' | ')}`);
  console.log('\nE2E numérico: 10 comprobaciones superadas, sin errores de JavaScript.');
} finally {
  await browser.close();
}
