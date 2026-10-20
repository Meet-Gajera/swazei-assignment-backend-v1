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
 * Scenarios 1, 2 and 4 of the assignment:
 *  - a successful sale and a failed sale
 *  - insufficient inventory
 *  - a duplicated POS request must not create a second sale
 * Bonus: concurrent sales must not oversell the stock.
 */
describe('Sales (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tenantA: TestTenant;
  let tokenA: string;

  beforeAll(async () => {
    app = await createTestApp();
    const seeded = await seedTestData(app);
    dataSource = seeded.dataSource;
    tenantA = seeded.tenantA;
    tokenA = await login(app, tenantA.admin.email);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('creates a successful sale, uses server side prices and decrements the stock', async () => {
    await setStock(dataSource, tenantA.store.id, tenantA.product.id, 10);

    const response = await request(app.getHttpServer())
      .post(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', 'e2e-success-1')
      .send({ items: [{ productId: tenantA.product.id, quantity: 2 }] })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('COMPLETED');
    expect(response.body.data.paymentStatus).toBe('SUCCESS');
    // 2 x 25.50 -> 51.00 (the price comes from the catalogue, not the client)
    expect(response.body.data.totalAmount).toBe(51);
    expect(response.body.data.items[0].unitPrice).toBe(25.5);
    expect(response.body.data.items[0].lineTotal).toBe(51);
    expect(response.body.data.replayed).toBe(false);

    const stock = await getStock(
      dataSource,
      tenantA.store.id,
      tenantA.product.id,
    );
    expect(stock).toBe(8);
  });

  it('records a FAILED sale when the payment provider declines (stock untouched)', async () => {
    await setStock(dataSource, tenantA.store.id, tenantA.product.id, 10);

    const response = await request(app.getHttpServer())
      .post(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', 'e2e-failed-1')
      .send({
        items: [{ productId: tenantA.product.id, quantity: 2 }],
        paymentToken: 'fail_token',
      })
      .expect(402);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PAYMENT_FAILED');
    expect(response.body.error.details.saleId).toBeDefined();
    expect(response.body.error.details.status).toBe('FAILED');

    // The stock must NOT be decremented for a declined payment.
    const stock = await getStock(
      dataSource,
      tenantA.store.id,
      tenantA.product.id,
    );
    expect(stock).toBe(10);

    // The failed sale is persisted for the audit trail.
    const sales = await request(app.getHttpServer())
      .get(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const failedSale = sales.body.data.items.find(
      (sale: { id: string }) => sale.id === response.body.error.details.saleId,
    );
    expect(failedSale).toBeDefined();
    expect(failedSale.status).toBe('FAILED');
    expect(failedSale.paymentStatus).toBe('FAILED');
  });

  it('rejects a sale when there is not enough inventory', async () => {
    await setStock(dataSource, tenantA.store.id, tenantA.product.id, 3);

    const response = await request(app.getHttpServer())
      .post(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', 'e2e-insufficient-1')
      .send({ items: [{ productId: tenantA.product.id, quantity: 5 }] })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INSUFFICIENT_INVENTORY');
    expect(response.body.error.details.required).toBe(5);
    expect(response.body.error.details.available).toBe(3);

    // Nothing was written.
    const stock = await getStock(
      dataSource,
      tenantA.store.id,
      tenantA.product.id,
    );
    expect(stock).toBe(3);
  });

  it('does not create a second sale for a duplicated POS request', async () => {
    await setStock(dataSource, tenantA.store.id, tenantA.product.id, 10);

    const payload = { items: [{ productId: tenantA.product.id, quantity: 2 }] };

    const first = await request(app.getHttpServer())
      .post(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', 'e2e-duplicate-1')
      .send(payload)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', 'e2e-duplicate-1')
      .send(payload)
      .expect(201);

    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.replayed).toBe(true);
    expect(second.body.data.totalAmount).toBe(first.body.data.totalAmount);

    // The stock was decremented exactly once.
    const stock = await getStock(
      dataSource,
      tenantA.store.id,
      tenantA.product.id,
    );
    expect(stock).toBe(8);

    const sales = await request(app.getHttpServer())
      .get(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const matching = sales.body.data.items.filter(
      (sale: { idempotencyKey: string }) =>
        sale.idempotencyKey === 'e2e-duplicate-1',
    );
    expect(matching).toHaveLength(1);
  });

  it('requires an Idempotency-Key header', async () => {
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/sales`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ items: [{ productId: tenantA.product.id, quantity: 1 }] })
      .expect(400);
  });

  it('never oversells the stock with two concurrent POS terminals', async () => {
    await setStock(dataSource, tenantA.store.id, tenantA.product.id, 5);

    const sellThree = (key: string) =>
      request(app.getHttpServer())
        .post(`${API_PREFIX}/sales`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', key)
        .send({ items: [{ productId: tenantA.product.id, quantity: 3 }] });

    const [a, b] = await Promise.all([
      sellThree('e2e-concurrent-a'),
      sellThree('e2e-concurrent-b'),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failed = a.status === 409 ? a : b;
    expect(failed.body.error.code).toBe('INSUFFICIENT_INVENTORY');

    // 5 - 3 = 2, never negative.
    const stock = await getStock(
      dataSource,
      tenantA.store.id,
      tenantA.product.id,
    );
    expect(stock).toBe(2);
  });
});
