import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  API_PREFIX,
  closeTestApp,
  createTestApp,
  login,
  seedTestData,
  TestTenant,
} from './helpers/test-app';

/**
 * Authentication, authorisation, DTO validation and the CRUD surface of the
 * catalogue / inventory resources.
 */
describe('API surface (e2e)', () => {
  let app: INestApplication;
  let tenantA: TestTenant;
  let tokenA: string;
  let cashierTokenA: string;

  beforeAll(async () => {
    app = await createTestApp();
    const seeded = await seedTestData(app);
    tenantA = seeded.tenantA;
    tokenA = await login(app, tenantA.admin.email);
    cashierTokenA = await login(app, tenantA.cashier.email);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('exposes a public health endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/health`)
      .expect(200);

    expect(response.body.data.status).toBe('ok');
  });

  it('rejects an invalid login payload', async () => {
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
  });

  it('rejects a wrong password', async () => {
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: tenantA.admin.email, password: 'WrongPassword1!' })
      .expect(401);
  });

  it('returns the authenticated principal', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body.data.id).toBe(tenantA.admin.id);
    expect(response.body.data.role).toBe('MERCHANT_ADMIN');
    expect(response.body.data.merchantId).toBe(tenantA.merchant.id);
  });

  it('validates the create product DTO', async () => {
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/products`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'No sku', price: -5 })
      .expect(400);
  });

  it('rejects unknown fields in the DTO (whitelist + forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/products`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Valid product',
        sku: `VALID-${Date.now()}`,
        price: 10,
        hacked: true,
      })
      .expect(400);
  });

  it('creates and reads back a product', async () => {
    const created = await request(app.getHttpServer())
      .post(`${API_PREFIX}/products`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Cold Brew',
        sku: `CB-${Date.now()}`,
        price: 120.5,
      })
      .expect(201);

    expect(created.body.data.price).toBe(120.5);

    const fetched = await request(app.getHttpServer())
      .get(`${API_PREFIX}/products/${created.body.data.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(fetched.body.data.sku).toBe(created.body.data.sku);
  });

  it('prevents a cashier from creating a product (RBAC)', async () => {
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/products`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ name: 'Nope', sku: `NOPE-${Date.now()}`, price: 1 })
      .expect(403);
  });

  it('adjusts the store inventory', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${API_PREFIX}/inventory`)
      .query({ storeId: tenantA.store.id })
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ productId: tenantA.product2.id, quantity: 42 })
      .expect(200);

    expect(response.body.data.quantity).toBe(42);
  });

  it('returns the sales summary of a store', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/sales/summary`)
      .query({ storeId: tenantA.store.id })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body.data.storeId).toBe(tenantA.store.id);
    expect(response.body.data.totalSales).toBeGreaterThanOrEqual(0);
  });
});
