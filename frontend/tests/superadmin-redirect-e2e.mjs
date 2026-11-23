import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE_URL;
const EMAIL = process.env.E2E_SUPERADMIN_EMAIL;
const PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD;
const FORBIDDEN_MESSAGE = 'No tiene permisos para acceder a este módulo';
const FORBIDDEN_DETAIL = 'Su rol no autoriza esta operación';

if (!BASE || !EMAIL || !PASSWORD) {
  console.error('Defina E2E_BASE_URL, E2E_SUPERADMIN_EMAIL y E2E_SUPERADMIN_PASSWORD antes de ejecutar esta prueba.');
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
  const errors = [];
  const forbiddenResponses = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() === 403) forbiddenResponses.push(response.url());
  });

  // 1. Una ruta de inventario sin sesión debe llevar al login, no a un error.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForURL(`${BASE}/login`, { timeout: 10000 });
  console.log('1. Ruta protegida redirige al login');

  // 2. El login debe respetar SIEMPRE el home del rol, aunque `state.from` sea `/`.
  await page.getByLabel('Correo electrónico').fill(EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await page.waitForURL(`${BASE}/superadmin`, { timeout: 15000 });
  await page.getByText('Administración general').first().waitFor({ timeout: 10000 });
  console.log('2. Superadministrador aterriza en /superadmin');

  // 3. No debe aparecer la pantalla de acceso denegado ni sus textos.
  assert.equal(await page.getByText(FORBIDDEN_MESSAGE).count(), 0, 'No debe mostrarse acceso denegado');
  assert.equal(await page.getByText(FORBIDDEN_DETAIL).count(), 0, 'No debe mostrarse el detalle de acceso denegado');
  console.log('3. Sin pantalla de permisos insuficientes');

  // 4. Una URL directa a inventario debe devolverlo a su panel, no a /acceso-denegado.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForURL(`${BASE}/superadmin`, { timeout: 10000 });
  assert.equal(await page.getByText('Administración general').count() > 0, true);
  console.log('4. Ruta de inventario redirige al panel de superadministración');

  // 5. Ninguna llamada del flujo debe responder 403.
  assert.deepEqual(forbiddenResponses, [], `Respuestas 403 inesperadas: ${forbiddenResponses.join(' | ')}`);
  console.log('5. Ninguna respuesta HTTP 403 durante el flujo');

  assert.deepEqual(errors, [], `Errores de consola/navegador: ${errors.join(' | ')}`);
  console.log('\nE2E superadmin: 5 comprobaciones superadas, sin 403 ni errores de JavaScript.');
} finally {
  await browser.close();
}
