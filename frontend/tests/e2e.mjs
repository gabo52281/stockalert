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

  await page.getByPlaceholder('usuario@empresa.com').fill(process.env.E2E_EMAIL || 'admin@stockalert.local');
  await page.locator('input[autocomplete="current-password"]').fill(process.env.E2E_PASSWORD || 'Demo1234!');
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

  const statusResponse = page.waitForResponse(
    (response) => response.url().includes('/api/ia/status') && response.status() === 200,
    { timeout: 10000 },
  );
  await page.getByRole('link', { name: 'Asistente IA' }).click();
  await page.getByText('Copiloto de inventario').first().waitFor({ timeout: 10000 });
  await page.getByText('Recomendaciones importantes').waitFor({ timeout: 15000 });
  await page.getByText('Chat con tu copiloto').waitFor({ timeout: 10000 });
  await statusResponse;
  console.log('7. Copiloto con recomendaciones reales cargado');

  const aiAvailable = await page.getByText('OpenRouter gratuito', { exact: true }).count() > 0;
  console.log('8. Estado del chat:', aiAvailable ? 'OpenRouter disponible' : 'IA temporalmente fuera de servicio');

  async function ask(label, expectedMessages) {
    await page.getByRole('button', { name: label }).click();
    const consentButton = page.getByRole('button', { name: 'Autorizar resumen' });
    if (await consentButton.isVisible().catch(() => false)) await consentButton.click();
    await page.waitForFunction(
      (count) => document.querySelectorAll('.ai-message').length >= count,
      expectedMessages,
      { timeout: 30000 },
    );
  }

  await ask('¿Qué debo comprar esta semana?', 3);
  assert.equal(await page.getByText('Análisis local').count(), 0, 'No debe existir un modo de respuestas locales');
  const firstAnswer = await page.locator('.ai-message__bubble').last().innerText();
  assert.ok(firstAnswer.length > 0, 'Debe mostrarse una respuesta del proveedor o el aviso de servicio no disponible');
  if (aiAvailable) {
    assert.ok(!firstAnswer.includes('temporalmente fuera de servicio'), 'Con proveedor disponible no debe mostrarse el aviso de caída');
  } else {
    assert.ok(firstAnswer.includes('temporalmente fuera de servicio'), 'Sin proveedor debe mostrarse el aviso exacto');
  }
  console.log('9. Respuesta mostrada solo desde OpenRouter o aviso de servicio no disponible');

  await ask(/Tengo \$ 500\.000/, 5);
  assert.ok(await page.locator('.ai-message').count() >= 5, 'El chat debe conservar el historial');
  console.log('10. Segunda pregunta conserva el historial');

  await page.getByRole('button', { name: /Nueva conversación/ }).click();
  assert.equal(await page.locator('.ai-message').count(), 1, 'Nueva conversación debe reiniciar el historial');
  console.log('11. Nueva conversación reinicia el historial');

  await page.getByRole('link', { name: 'Reportes' }).click();
  await page.getByText('Configuración del reporte').waitFor({ timeout: 10000 });
  await page.locator('.data-table tbody tr').first().waitFor({ timeout: 15000 });
  const reportColumns = await page.locator('.data-table thead th').count();
  assert.ok(reportColumns > 0, 'El reporte debe mostrar columnas');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('button', { name: 'Exportar PDF' }).click(),
  ]);
  assert.match(download.suggestedFilename(), /\.pdf$/);
  console.log('12. Reportes con vista previa y descarga PDF:', download.suggestedFilename());

  // 3. Cierre de sesión
  await page.locator('.user-menu__trigger').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.waitForURL(`${BASE}/login`, { timeout: 10000 });
  console.log('13. Logout y redirección verificados');

  // 4. Vista móvil
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  assert.ok(await page.getByRole('button', { name: 'Ingresar al sistema' }).isVisible());
  console.log('14. Diseño responsive en 390 px verificado');

  assert.deepEqual(errors, [], `Errores de consola/navegador: ${errors.join(' | ')}`);
  console.log('\nE2E: 14 comprobaciones superadas, sin errores de JavaScript.');
} finally {
  await browser.close();
}
