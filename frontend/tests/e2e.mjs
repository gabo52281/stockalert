import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const HOME_PATH = process.env.E2E_HOME_PATH || '/';
const errors = [];

if (!EMAIL || !PASSWORD) {
  console.error('Defina E2E_EMAIL y E2E_PASSWORD antes de ejecutar las pruebas E2E.');
  process.exit(1);
}

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

  await page.getByPlaceholder('usuario@empresa.com').fill(EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await page.waitForURL((url) => url.pathname === HOME_PATH, { timeout: 15000 });
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
  await page.getByText('Asistente IA').first().waitFor({ timeout: 10000 });
  await page.getByText('Chat de inventario').waitFor({ timeout: 10000 });
  await statusResponse;
  console.log('7. Chat del asistente cargado');

  const aiAvailable = await page.getByText('Asistente IA activo', { exact: true }).count() > 0;
  console.log('8. Estado del chat:', aiAvailable ? 'Asistente IA activo' : 'IA temporalmente fuera de servicio');

  async function ask(label, expectedMessages) {
    await page.getByRole('button', { name: label }).click();
    await page.waitForFunction(
      (count) => document.querySelectorAll('.ai-message').length >= count,
      expectedMessages,
      { timeout: 60000 },
    );
  }

  await ask('¿Qué debo comprar esta semana?', 3);
  assert.equal(await page.getByText('Análisis local').count(), 0, 'No debe existir un modo de respuestas locales');
  const firstAnswer = await page.locator('.ai-message__bubble').last().innerText();
  assert.ok(firstAnswer.length > 0, 'Debe mostrarse una respuesta del proveedor o el aviso de servicio no disponible');
  // `status` solo confirma que hay clave configurada: OpenAI puede agotar
  // cuota o caer. En ese caso el aviso oficial es el único fallback permitido;
  // nunca una respuesta local.
  if (firstAnswer.includes('temporalmente fuera de servicio')) {
    assert.ok(
      firstAnswer.includes('recomendaciones automáticas de STOCKALERT'),
      'El aviso de caída debe ser el texto oficial, sin respuestas locales',
    );
  } else {
    assert.ok(aiAvailable, 'Sin proveedor configurado no debe mostrarse una respuesta generada');
  }
  console.log('9. Respuesta mostrada solo desde OpenAI o aviso de servicio no disponible');

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
