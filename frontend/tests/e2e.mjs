import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const errors = [];

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--no-sandbox'],
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  // 1. Pantalla de login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByText('Iniciar sesión').waitFor({ timeout: 10000 });
  console.log('1. Login renderizado correctamente');

  await page.getByPlaceholder('usuario@empresa.com').fill('admin@stockalert.local');
  await page.locator('input[autocomplete="current-password"]').fill('Demo1234!');
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  await page.getByText('Referencias activas').first().waitFor({ timeout: 15000 });
  console.log('2. Autenticación y panel principal cargados');

  const stats = await page.locator('.stat-card strong').allTextContents();
  assert.equal(stats.length, 4, 'El panel debe mostrar 4 tarjetas de indicadores');
  assert.ok(stats.every((value) => value.trim().length > 0), 'Las tarjetas deben tener valores reales');
  assert.ok(await page.locator('.recharts-surface').count() >= 2, 'Deben renderizarse las gráficas');
  console.log('3. Indicadores y gráficas con datos reales:', stats.join(' | '));

  // 2. Navegación a módulos
  await page.getByRole('link', { name: 'Productos' }).click();
  await page.getByText('Administre el catálogo').waitFor({ timeout: 10000 });
  await page.locator('.data-table tbody tr').first().waitFor({ timeout: 15000 });
  const productRows = await page.locator('.data-table tbody tr').count();
  assert.ok(productRows > 0, 'El catálogo debe mostrar productos');
  console.log('4. Productos:', productRows, 'filas visibles');

  await page.getByRole('link', { name: /Alertas/ }).first().click();
  await page.getByText('Alertas preventivas').first().waitFor({ timeout: 10000 });
  await page.getByText('Agotados').waitFor({ timeout: 10000 });
  await page.locator('.data-table tbody tr').first().waitFor({ timeout: 15000 });
  console.log('5. Módulo de alertas cargado con filas reales');

  await page.getByRole('link', { name: 'Indicadores' }).click();
  await page.getByText('Indicadores y cobertura').first().waitFor({ timeout: 10000 });
  await page.getByText(/Promedio de salidas diarias/).waitFor({ timeout: 10000 });
  await page.locator('.data-table tbody tr').first().waitFor({ timeout: 15000 });
  console.log('6. Módulo de indicadores cargado con cobertura real');

  await page.getByRole('link', { name: 'Asistente IA' }).click();
  await page.getByText('Resumen del asistente').first().waitFor({ timeout: 10000 });
  await page.getByText(/Se analizaron/).waitFor({ timeout: 15000 });
  console.log('7. Asistente IA con análisis real cargado');

  await page.getByRole('link', { name: 'Reportes' }).click();
  await page.getByText('Configuración del reporte').waitFor({ timeout: 10000 });
  await page.locator('.data-table tbody tr').first().waitFor({ timeout: 15000 });
  const reportColumns = await page.locator('.data-table thead th').count();
  assert.ok(reportColumns > 0, 'El reporte debe mostrar columnas');
  console.log('8. Reportes con vista previa de', reportColumns, 'columnas');

  // 3. Cierre de sesión
  await page.locator('.user-menu__trigger').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.waitForURL(`${BASE}/login`, { timeout: 10000 });
  console.log('9. Logout y redirección verificados');

  // 4. Vista móvil
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  assert.ok(await page.getByRole('button', { name: 'Ingresar al sistema' }).isVisible());
  console.log('10. Diseño responsive en 390 px verificado');

  assert.deepEqual(errors, [], `Errores de consola/navegador: ${errors.join(' | ')}`);
  console.log('\nE2E: 10 comprobaciones superadas, sin errores de JavaScript.');
} finally {
  await browser.close();
}
