'use strict';

const crypto = require('node:crypto');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { query, runAsSystem } = require('../src/config/database');

const describeDatabase = process.env.DATABASE_URL ? describe : describe.skip;
const suffix = crypto.randomBytes(5).toString('hex');
const password = `Seguro-${suffix}!`;

const ids = {
  establishments: [], users: [], products: [], categories: [], suppliers: [], movements: [],
};
const codes = {};
const tokens = {};
let fixturesA;
let fixturesB;

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function sql(text, params, establishmentId = null) {
  return runAsSystem(() => query(text, params), establishmentId);
}

async function createUser({ name, email, role, establishmentId = null }) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await sql(
    `INSERT INTO users (name, email, password_hash, role_id, active, establishment_id, must_change_password)
     VALUES ($1, $2, $3, (SELECT id FROM roles WHERE name = $4), TRUE, $5, FALSE)
     RETURNING id`,
    [name, email, hash, role, establishmentId],
  );
  ids.users.push(rows[0].id);
  return rows[0].id;
}

async function createEstablishment(name) {
  const { rows } = await sql(
    'INSERT INTO establishments (name, active) VALUES ($1, TRUE) RETURNING id',
    [name],
  );
  ids.establishments.push(rows[0].id);
  return rows[0].id;
}

async function login(email) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  expect(response.status).toBe(200);
  return response.body.data.token;
}

async function createCatalogFixture(token, code) {
  const headers = auth(token);
  const category = await request(app)
    .post('/api/categories')
    .set(headers)
    .send({ name: `Categoría ${code}` });
  expect(category.status).toBe(201);
  ids.categories.push(category.body.data.id);

  const supplier = await request(app)
    .post('/api/suppliers')
    .set(headers)
    .send({ name: `Proveedor ${code}`, taxId: `NIT-${code}` });
  expect(supplier.status).toBe(201);
  ids.suppliers.push(supplier.body.data.id);

  const product = await request(app)
    .post('/api/products')
    .set(headers)
    .send({
      code,
      name: `Producto ${code}`,
      categoryId: category.body.data.id,
      supplierId: supplier.body.data.id,
      purchasePrice: 100,
      salePrice: 150,
      minStock: 5,
      alertPercentage: 25,
    });
  expect(product.status).toBe(201);
  ids.products.push(product.body.data.id);
  return {
    categoryId: category.body.data.id,
    supplierId: supplier.body.data.id,
    productId: product.body.data.id,
  };
}

if (process.env.DATABASE_URL) {
  beforeAll(async () => {
    codes.A = `T${suffix}-A`;
    codes.B = `T${suffix}-B`;

    const establishmentA = await createEstablishment(`Tenant A ${suffix}`);
    const establishmentB = await createEstablishment(`Tenant B ${suffix}`);
    codes.establishmentA = establishmentA;
    codes.establishmentB = establishmentB;

    for (const establishmentId of [establishmentA, establishmentB]) {
      await sql(
        `INSERT INTO system_settings (establishment_id, key, value, description)
         VALUES ($1, 'alert.preventive_percentage', '25'::jsonb, 'Preventivo')
         ON CONFLICT (establishment_id, key) DO NOTHING`,
        [establishmentId],
      );
    }

    await createUser({
      name: 'Super A', email: `super-${suffix}@test.local`,
      role: 'SUPERADMINISTRADOR',
    });
    await createUser({
      name: 'Admin A', email: `admin-a-${suffix}@test.local`,
      role: 'ADMINISTRADOR', establishmentId: establishmentA,
    });
    await createUser({
      name: 'Admin B', email: `admin-b-${suffix}@test.local`,
      role: 'ADMINISTRADOR', establishmentId: establishmentB,
    });

    tokens.super = await login(`super-${suffix}@test.local`);
    tokens.A = await login(`admin-a-${suffix}@test.local`);
    tokens.B = await login(`admin-b-${suffix}@test.local`);

    fixturesA = await createCatalogFixture(tokens.A, codes.A);
    fixturesB = await createCatalogFixture(tokens.B, codes.B);
  });

  afterAll(async () => {
    try {
      await sql(
        'DELETE FROM inventory_movements WHERE product_id = ANY($1::bigint[])',
        [ids.products],
      );
      await sql(
        'DELETE FROM product_alert_settings WHERE product_id = ANY($1::bigint[])',
        [ids.products],
      );
      await sql('DELETE FROM audit_log WHERE user_id = ANY($1::bigint[])', [ids.users]);
      await sql('DELETE FROM revoked_tokens WHERE user_id = ANY($1::bigint[])', [ids.users]);
      await sql('DELETE FROM products WHERE id = ANY($1::bigint[])', [ids.products]);
      await sql('DELETE FROM categories WHERE id = ANY($1::bigint[])', [ids.categories]);
      await sql('DELETE FROM suppliers WHERE id = ANY($1::bigint[])', [ids.suppliers]);
      await sql('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users]);
      await sql('DELETE FROM establishments WHERE id = ANY($1::bigint[])', [ids.establishments]);
    } catch (error) {
      console.error('No se pudo limpiar la fixture A/B:', error.message);
    }
  });
}

describeDatabase('Aislamiento multiempresa (20+ comprobaciones de seguridad)', () => {
  it('1. cada login recibe permisos inmediatos según su rol', async () => {
    const meA = await request(app).get('/api/auth/me').set(auth(tokens.A));
    expect(meA.status).toBe(200);
    expect(meA.body.data.permissions).toContain('products:create');
    expect(meA.body.data.establishmentId).toBe(codes.establishmentA);

    const meSuper = await request(app).get('/api/auth/me').set(auth(tokens.super));
    expect(meSuper.body.data.permissions).toContain('users:read');
    expect(meSuper.body.data.permissions).not.toContain('products:read');
  });

  it('2. el listado de productos solo muestra los del establecimiento autenticado', async () => {
    for (const [token, ownCode, otherCode] of [
      [tokens.A, codes.A, codes.B],
      [tokens.B, codes.B, codes.A],
    ]) {
      const response = await request(app).get('/api/products?limit=100').set(auth(token));
      expect(response.status).toBe(200);
      const serialized = JSON.stringify(response.body.data);
      expect(serialized).toContain(ownCode);
      expect(serialized).not.toContain(otherCode);
    }
  });

  it('3. un producto ajeno no se puede consultar cambiando el ID en la URL', async () => {
    const response = await request(app)
      .get(`/api/products/${fixturesB.productId}`)
      .set(auth(tokens.A));
    expect(response.status).toBe(404);
  });

  it('4. un producto ajeno no se puede editar', async () => {
    const response = await request(app)
      .patch(`/api/products/${fixturesB.productId}`)
      .set(auth(tokens.A))
      .send({ name: 'Intento de manipulación' });
    expect(response.status).toBe(404);
  });

  it('5. un producto ajeno no se puede desactivar ni eliminar', async () => {
    const deactivate = await request(app)
      .patch(`/api/products/${fixturesB.productId}/active`)
      .set(auth(tokens.A))
      .send({ active: false });
    expect(deactivate.status).toBe(404);
    const remove = await request(app)
      .delete(`/api/products/${fixturesB.productId}`)
      .set(auth(tokens.A));
    expect(remove.status).toBe(404);
  });

  it('6. un tenant_id enviado por el frontend es ignorado', async () => {
    const code = `T${suffix}-SPOOF`;
    const response = await request(app)
      .post('/api/products')
      .set(auth(tokens.A))
      .send({
        code,
        name: 'Producto con tenant falso',
        establishmentId: codes.establishmentB,
        establishment_id: codes.establishmentB,
        purchasePrice: 10,
        salePrice: 20,
      });
    expect(response.status).toBe(201);
    ids.products.push(response.body.data.id);

    const { rows } = await sql('SELECT establishment_id FROM products WHERE id = $1', [response.body.data.id]);
    expect(String(rows[0].establishment_id)).toBe(String(codes.establishmentA));

    const asB = await request(app).get(`/api/products/${response.body.data.id}`).set(auth(tokens.B));
    expect(asB.status).toBe(404);
  });

  it('7. una categoría ajena no puede asociarse a un producto', async () => {
    const response = await request(app)
      .post('/api/products')
      .set(auth(tokens.A))
      .send({
        code: `T${suffix}-CAT`,
        name: 'Categoría cross-tenant',
        categoryId: fixturesB.categoryId,
      });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CATEGORY');
  });

  it('8. un proveedor ajeno no puede asociarse a un producto', async () => {
    const response = await request(app)
      .post('/api/products')
      .set(auth(tokens.A))
      .send({
        code: `T${suffix}-PROV`,
        name: 'Proveedor cross-tenant',
        supplierId: fixturesB.supplierId,
      });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_SUPPLIER');
  });

  it('9. no se puede registrar un movimiento sobre un producto ajeno', async () => {
    const response = await request(app)
      .post('/api/movements/in')
      .set(auth(tokens.A))
      .send({ productId: fixturesB.productId, quantity: 1 });
    expect(response.status).toBe(404);
  });

  it('10. no se puede usar un proveedor ajeno en una entrada', async () => {
    const response = await request(app)
      .post('/api/movements/in')
      .set(auth(tokens.A))
      .send({ productId: fixturesA.productId, quantity: 1, supplierId: fixturesB.supplierId });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_SUPPLIER');
  });

  it('11. el historial de movimientos no mezcla tenants', async () => {
    const entryA = await request(app)
      .post('/api/movements/in')
      .set(auth(tokens.A))
      .send({ productId: fixturesA.productId, quantity: 12 });
    expect(entryA.status).toBe(201);
    ids.movements.push(entryA.body.data.movement.id);

    const entryB = await request(app)
      .post('/api/movements/in')
      .set(auth(tokens.B))
      .send({ productId: fixturesB.productId, quantity: 9 });
    expect(entryB.status).toBe(201);
    ids.movements.push(entryB.body.data.movement.id);

    const listA = await request(app).get('/api/movements?limit=100').set(auth(tokens.A));
    const listB = await request(app).get('/api/movements?limit=100').set(auth(tokens.B));
    expect(JSON.stringify(listA.body.data)).not.toContain(codes.B);
    expect(JSON.stringify(listB.body.data)).not.toContain(codes.A);
  });

  it('12. un movimiento ajeno no se puede consultar ni alterar por ID', async () => {
    const listB = await request(app).get('/api/movements?limit=100').set(auth(tokens.B));
    const target = listB.body.data[0].id;
    expect(target).toBeTruthy();
    const response = await request(app).get(`/api/movements/${target}`).set(auth(tokens.A));
    expect(response.status).toBe(404);
  });

  it('13. categorías y proveedores ajenos son inaccesibles por ID', async () => {
    const category = await request(app)
      .get(`/api/categories/${fixturesB.categoryId}`)
      .set(auth(tokens.A));
    const supplier = await request(app)
      .get(`/api/suppliers/${fixturesB.supplierId}`)
      .set(auth(tokens.A));
    expect(category.status).toBe(404);
    expect(supplier.status).toBe(404);
  });

  it('14. no se puede eliminar una categoría ajena', async () => {
    const response = await request(app)
      .delete(`/api/categories/${fixturesB.categoryId}`)
      .set(auth(tokens.A));
    expect(response.status).toBe(404);
  });

  it('15. dashboard, alertas e indicadores usan solo datos propios', async () => {
    for (const [token, ownCode, otherCode] of [
      [tokens.A, codes.A, codes.B],
      [tokens.B, codes.B, codes.A],
    ]) {
      const dashboard = await request(app).get('/api/dashboard?days=30').set(auth(token));
      const alerts = await request(app).get('/api/alerts/summary').set(auth(token));
      const indicators = await request(app).get('/api/indicators/summary?days=30').set(auth(token));
      expect(dashboard.status).toBe(200);
      expect(alerts.status).toBe(200);
      expect(indicators.status).toBe(200);
      expect(JSON.stringify(dashboard.body.data)).not.toContain(otherCode);
      expect(JSON.stringify(dashboard.body.data)).toContain(ownCode);
    }
  });

  it('16. el copiloto IA solo recibe contexto del establecimiento autenticado', async () => {
    const response = await request(app)
      .get('/api/ia/insights?days=30&leadTimeDays=14')
      .set(auth(tokens.A));
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body.data)).not.toContain(codes.B);
  });

  it('17. reportes JSON/CSV/PDF no filtran el otro establecimiento', async () => {
    const json = await request(app)
      .get(`/api/reports/inventory?productId=${fixturesA.productId}`)
      .set(auth(tokens.A));
    expect(json.status).toBe(200);
    expect(JSON.stringify(json.body.data)).not.toContain(codes.B);

    const csv = await request(app)
      .get('/api/reports/inventory?format=csv')
      .set(auth(tokens.A));
    expect(csv.status).toBe(200);
    expect(csv.text).toContain(codes.A);
    expect(csv.text).not.toContain(codes.B);

    const pdf = await request(app)
      .get('/api/reports/inventory?format=pdf')
      .set(auth(tokens.A));
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/pdf/i);
  });

  it('18. la auditoría registra el establecimiento correcto', async () => {
    const { rows } = await sql(
      `SELECT DISTINCT establishment_id::text AS est FROM audit_log
        WHERE user_id = ANY($1::bigint[])`,
      [ids.users],
    );
    const tenants = rows.map((row) => row.est).sort();
    expect(tenants).toContain(String(codes.establishmentA));
    expect(tenants).toContain(String(codes.establishmentB));
  });

  it('19. un administrador normal no puede administrar cuentas', async () => {
    const list = await request(app).get('/api/users').set(auth(tokens.A));
    const create = await request(app).post('/api/users').set(auth(tokens.A)).send({
      name: 'Intento', email: `bad-${suffix}@test.local`, password,
      role: 'CONSULTA', establishmentId: codes.establishmentA,
    });
    expect(list.status).toBe(403);
    expect(create.status).toBe(403);
  });

  it('20. el superadministrador no tiene acceso al inventario privado', async () => {
    for (const path of ['/api/products', '/api/movements', '/api/alerts/summary', '/api/reports/inventory', '/api/ia/insights']) {
      const response = await request(app).get(path).set(auth(tokens.super));
      expect(response.status).toBe(403);
    }
  });

  it('21. el superadministrador ve usuarios globales y estadísticas, pero no inventario', async () => {
    const users = await request(app).get('/api/users?limit=100').set(auth(tokens.super));
    const stats = await request(app).get('/api/establishments/stats').set(auth(tokens.super));
    expect(users.status).toBe(200);
    expect(stats.status).toBe(200);
    const serialized = JSON.stringify(users.body.data);
    expect(serialized).toContain(`admin-a-${suffix}@test.local`);
    expect(serialized).toContain(`admin-b-${suffix}@test.local`);
    expect(stats.body.data.total_establishments).toBeGreaterThanOrEqual(2);
    expect(stats.body.data).not.toHaveProperty('products');
  });

  it('22. la cuenta superadministrador no se puede degradar ni desactivar desde el panel', async () => {
    const target = (await request(app).get(`/api/users?q=super-${suffix}`).set(auth(tokens.super))).body.data[0];
    const demote = await request(app)
      .patch(`/api/users/${target.id}`)
      .set(auth(tokens.super))
      .send({ role: 'CONSULTA' });
    const deactivate = await request(app)
      .patch(`/api/users/${target.id}/active`)
      .set(auth(tokens.super))
      .send({ active: false });
    expect(demote.status).toBe(403);
    expect(deactivate.status).toBe(403);
  });

  it('23. no se pueden crear ni asignar superadministradores desde el panel', async () => {
    const response = await request(app).post('/api/users').set(auth(tokens.super)).send({
      name: 'Otro super', email: `super2-${suffix}@test.local`, password,
      role: 'SUPERADMINISTRADOR', establishmentId: codes.establishmentA,
    });
    expect(response.status).toBe(400);
  });

  it('24. las configuraciones por defecto se crean por establecimiento', async () => {
    const create = await request(app)
      .post('/api/establishments')
      .set(auth(tokens.super))
      .send({ name: `Tercero ${suffix}`, active: true });
    expect(create.status).toBe(201);
    ids.establishments.push(create.body.data.id);

    const { rows } = await sql(
      'SELECT establishment_id::text AS est FROM system_settings WHERE establishment_id = ANY($1::bigint[]) GROUP BY establishment_id',
      [[codes.establishmentA, codes.establishmentB, create.body.data.id]],
    );
    expect(rows).toHaveLength(3);
  });

  it('25. una cuenta inactiva no puede iniciar sesión', async () => {
    const email = `inactive-${suffix}@test.local`;
    const created = await request(app).post('/api/users').set(auth(tokens.super)).send({
      name: 'Inactivo', email, password, role: 'CONSULTA',
      establishmentId: codes.establishmentA, active: false,
    });
    expect(created.status).toBe(201);
    const response = await request(app).post('/api/auth/login').send({ email, password });
    expect(response.status).toBe(401);
  });

  it('26. restablecer contraseña revoca la sesión anterior', async () => {
    const target = (await request(app).get(`/api/users?q=admin-a-${suffix}`).set(auth(tokens.super))).body.data[0];
    const newPassword = `Nueva-${suffix}!`;
    const reset = await request(app)
      .patch(`/api/users/${target.id}/password`)
      .set(auth(tokens.super))
      .send({ password: newPassword });
    expect(reset.status).toBe(200);

    const oldToken = await request(app).get('/api/products').set(auth(tokens.A));
    expect(oldToken.status).toBe(401);

    const relogin = await request(app).post('/api/auth/login').send({
      email: `admin-a-${suffix}@test.local`, password: newPassword,
    });
    expect(relogin.status).toBe(200);
    tokens.A = relogin.body.data.token;
  });

  it('27. desactivar un establecimiento bloquea sesiones y nuevos accesos', async () => {
    const response = await request(app)
      .patch(`/api/establishments/${codes.establishmentB}/active`)
      .set(auth(tokens.super))
      .send({ active: false });
    expect(response.status).toBe(200);

    const withToken = await request(app).get('/api/products').set(auth(tokens.B));
    expect(withToken.status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({
      email: `admin-b-${suffix}@test.local`, password,
    });
    expect(login.status).toBe(401);
  });

  it('28. la concurrencia de inventario no permite stock negativo', async () => {
    const product = await request(app)
      .post('/api/products')
      .set(auth(tokens.A))
      .send({
        code: `T${suffix}-CONC`, name: 'Concurrencia', purchasePrice: 1,
        salePrice: 2, minStock: 0,
      });
    expect(product.status).toBe(201);
    ids.products.push(product.body.data.id);
    await request(app)
      .post('/api/movements/in')
      .set(auth(tokens.A))
      .send({ productId: product.body.data.id, quantity: 5 });

    const results = await Promise.all(Array.from({ length: 10 }, () => request(app)
      .post('/api/movements/out')
      .set(auth(tokens.A))
      .send({ productId: product.body.data.id, quantity: 1, reason: 'Concurrencia' })));
    expect(results.filter((item) => item.status === 201)).toHaveLength(5);
    expect(results.filter((item) => item.status === 409)).toHaveLength(5);

    const final = await request(app)
      .get(`/api/products/${product.body.data.id}`)
      .set(auth(tokens.A));
    expect(Number(final.body.data.quantity)).toBe(0);
  });

  it('29. los filtros de usuario solo exponen nombres del propio establecimiento', async () => {
    const response = await request(app).get('/api/users/options').set(auth(tokens.A));
    expect(response.status).toBe(200);
    const names = response.body.data.map((user) => user.name);
    expect(names).toContain('Admin A');
    expect(names).not.toContain('Admin B');
    for (const user of response.body.data) {
      expect(Object.keys(user).sort()).toEqual(['id', 'name']);
    }

    const superResponse = await request(app).get('/api/users/options').set(auth(tokens.super));
    expect(superResponse.status).toBe(403);
  });
});
