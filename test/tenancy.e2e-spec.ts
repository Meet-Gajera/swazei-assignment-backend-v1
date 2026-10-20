import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import {
  API_PREFIX,
  closeTestApp,
  createTestApp,
  getStock,
  login,
  seedTestData,
  setStock,
  TestTenant,
} from './helpers/test-app';

/**
 * Scenario 3 of the assignment: cross tenant access must be rejected.
 *
 * Changing an id in a request must never expose another merchant's data.
 */
describe('Multi tenant isolation (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let tokenA: string;
  let tokenB: string;
  let cashierTokenA: string;

  beforeAll(async () => {
    app = await createTestApp();
    const seeded = await seedTestData(app);
    dataSource = seeded.dataSource;
    tenantA = seeded.tenantA;
    tenantB = seeded.tenantB;
    tokenA = await login(app, tenantA.admin.email);
    tokenB = await login(app, tenantB.admin.email);
    cashierTokenA = await login(app, tenantA.cashier.email);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('does not expose a product of another merchant', async () => {
    await request(app.getHttpServer())
      .get(`${API_PREFIX}/products/${tenantB.product.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('does not expose a store of another merchant', async () => {
    await request(app.getHttpServer())
      .get(`${API_PREFIX}/stores/${tenantB.store.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('does not expose a user of another merchant', async () => {
    await request(app.getHttpServer())
      .get(`${API_PREFIX}/users/${tenantB.admin.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('only lists the products of the authenticated merchant', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/products`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const merchantIds = new Set(
      response.body.data.items.map((p: { merchantId: string }) => p.merchantId),
    );
    expect(merchantIds.size).toBe(1);
    expect([...merchantIds][0]).toBe(tenantA.merchant.id);
    expect(
      response.body.data.items.some(
        (p: { id: string }) => p.id === tenantB.product.id,
      ),
    ).toBe(false);
  });

  it('refuses to sell a product that belongs to another merchant', async () => {
    await setStock(dataSource, tenantB.store.id, tenantB.product.id, 10);

    const response = await request(app.getHttpServer())
      .post(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', 'cross-tenant-sale')
      .send({ items: [{ productId: tenantB.product.id, quantity: 1 }] })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toMatch(
      /do not exist or do not belong/i,
    );
    expect(response.body.error.details.productIds).toContain(
      tenantB.product.id,
    );

    // The other merchant's stock is untouched.
    const stock = await getStock(
      dataSource,
      tenantB.store.id,
      tenantB.product.id,
    );
    expect(stock).toBe(10);
  });

  it('refuses to sell into a store of another merchant', async () => {
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', 'cross-tenant-store-sale')
      .send({
        storeId: tenantB.store.id,
        items: [{ productId: tenantA.product.id, quantity: 1 }],
      })
      .expect(403);
  });

  it('hides the sales of another merchant', async () => {
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('Idempotency-Key', 'tenant-b-sale')
      .send({ items: [{ productId: tenantB.product.id, quantity: 1 }] })
      .expect(201);

    const responseB = await request(app.getHttpServer())
      .get(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const salesB = responseB.body.data.items;
    expect(salesB.length).toBeGreaterThan(0);

    const responseA = await request(app.getHttpServer())
      .get(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const idsA = responseA.body.data.items.map((s: { id: string }) => s.id);
    for (const sale of salesB) {
      expect(idsA).not.toContain(sale.id);
    }
  });

  it('does not let a store manager of merchant A sell in another store', async () => {
    const response = await request(app.getHttpServer())
      .post(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .set('Idempotency-Key', 'cashier-cross-store')
      .send({
        storeId: tenantB.store.id,
        items: [{ productId: tenantA.product.id, quantity: 1 }],
      })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CROSS_TENANT_ACCESS');
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer())
      .get(`${API_PREFIX}/products`)
      .expect(401);
  });
});
