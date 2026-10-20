import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import {
  Inventory,
  Merchant,
  Product,
  Store,
  User,
} from '../../src/database/entities';
import { UserRole } from '../../src/common/enums';

/** Global prefix used when building request paths (leading slash required by supertest). */
export const API_PREFIX = '/api/v1';

/** Global prefix registered on the Nest application. */
export const NEST_GLOBAL_PREFIX = 'api/v1';
export const TEST_PASSWORD = 'Passw0rd!';

export interface TestTenant {
  merchant: Merchant;
  store: Store;
  admin: User;
  cashier: User;
  product: Product;
  product2: Product;
  inventory: Inventory;
}

export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
  tenantA: TestTenant;
  tenantB: TestTenant;
  tokenA: string;
  tokenB: string;
  cashierTokenA: string;
  cashierTokenB: string;
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(NEST_GLOBAL_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // The HTTP server must be listening before supertest touches it: otherwise
  // supertest starts (and later closes) the server itself, which breaks every
  // request that follows the first one.
  await app.listen(0, '127.0.0.1');
  return app;
}

export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
  try {
    const dataSource = app.get(DataSource);
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  } catch {
    /* the data source may already be closed */
  }
}

export async function login(
  app: INestApplication,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post(`${API_PREFIX}/auth/login`)
    .send({ email, password })
    .expect(200);

  return response.body.data.accessToken as string;
}

async function createTenant(
  dataSource: DataSource,
  suffix: string,
  label: string,
  productPrice: number,
  stock: number,
): Promise<TestTenant> {
  const merchant = await dataSource.getRepository(Merchant).save(
    dataSource.getRepository(Merchant).create({
      name: `${label} ${suffix}`,
      status: 'ACTIVE',
    }),
  );

  const store = await dataSource.getRepository(Store).save(
    dataSource.getRepository(Store).create({
      merchantId: merchant.id,
      name: `${label} Store ${suffix}`,
      status: 'ACTIVE',
    }),
  );

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const admin = await dataSource.getRepository(User).save(
    dataSource.getRepository(User).create({
      merchantId: merchant.id,
      storeId: store.id,
      email: `admin.${suffix}@example.com`,
      password: passwordHash,
      name: `${label} Admin`,
      role: UserRole.MERCHANT_ADMIN,
      status: 'ACTIVE',
    }),
  );

  const cashier = await dataSource.getRepository(User).save(
    dataSource.getRepository(User).create({
      merchantId: merchant.id,
      storeId: store.id,
      email: `cashier.${suffix}@example.com`,
      password: passwordHash,
      name: `${label} Cashier`,
      role: UserRole.CASHIER,
      status: 'ACTIVE',
    }),
  );

  const product = await dataSource.getRepository(Product).save(
    dataSource.getRepository(Product).create({
      merchantId: merchant.id,
      name: `${label} Product`,
      sku: `SKU-${suffix}-1`,
      price: productPrice,
      status: 'ACTIVE',
    }),
  );

  const product2 = await dataSource.getRepository(Product).save(
    dataSource.getRepository(Product).create({
      merchantId: merchant.id,
      name: `${label} Product 2`,
      sku: `SKU-${suffix}-2`,
      price: 10,
      status: 'ACTIVE',
    }),
  );

  const inventory = await dataSource.getRepository(Inventory).save(
    dataSource.getRepository(Inventory).create({
      storeId: store.id,
      productId: product.id,
      quantity: stock,
    }),
  );

  return { merchant, store, admin, cashier, product, product2, inventory };
}

export async function seedTestData(app: INestApplication): Promise<{
  dataSource: DataSource;
  tenantA: TestTenant;
  tenantB: TestTenant;
}> {
  const dataSource = app.get(DataSource);
  const suffix = Date.now().toString(36);

  const tenantA = await createTenant(
    dataSource,
    `${suffix}a`,
    'TenantA',
    25.5,
    10,
  );
  const tenantB = await createTenant(
    dataSource,
    `${suffix}b`,
    'TenantB',
    99.99,
    10,
  );

  return { dataSource, tenantA, tenantB };
}

export async function setStock(
  dataSource: DataSource,
  storeId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const repo = dataSource.getRepository(Inventory);
  const existing = await repo.findOne({ where: { storeId, productId } });
  if (existing) {
    existing.quantity = quantity;
    await repo.save(existing);
    return;
  }
  await repo.save(repo.create({ storeId, productId, quantity }));
}

export async function getStock(
  dataSource: DataSource,
  storeId: string,
  productId: string,
): Promise<number> {
  const inventory = await dataSource.getRepository(Inventory).findOne({
    where: { storeId, productId },
  });
  return inventory?.quantity ?? -1;
}
