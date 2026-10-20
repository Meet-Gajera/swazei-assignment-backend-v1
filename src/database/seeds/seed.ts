import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Inventory, Merchant, Product, Store, User } from '../entities';
import { UserRole } from '../../common/enums';

const SALT_ROUNDS = 10;

export const DEFAULT_PASSWORD = 'Passw0rd!';

export interface SeedResult {
  merchants: string[];
  stores: string[];
  users: string[];
  products: string[];
}

/**
 * Idempotent seed data.
 *
 * Merchant A -> Store 1, Store 2
 * Merchant B -> Store 3
 *
 * The two merchants deliberately own products with the same SKU so that
 * cross-tenant isolation can be verified (a product id of merchant B must
 * never be reachable from merchant A).
 */
export async function seed(dataSource: DataSource): Promise<SeedResult> {
  const merchantRepo = dataSource.getRepository(Merchant);
  const storeRepo = dataSource.getRepository(Store);
  const userRepo = dataSource.getRepository(User);
  const productRepo = dataSource.getRepository(Product);
  const inventoryRepo = dataSource.getRepository(Inventory);

  const result: SeedResult = {
    merchants: [],
    stores: [],
    users: [],
    products: [],
  };

  const password = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  const ensureMerchant = async (name: string): Promise<Merchant> => {
    let merchant = await merchantRepo.findOne({ where: { name } });
    if (!merchant) {
      merchant = await merchantRepo.save(
        merchantRepo.create({
          name,
          description: `${name} (seed data)`,
          status: 'ACTIVE',
        }),
      );
    }
    result.merchants.push(merchant.id);
    return merchant;
  };

  const ensureStore = async (
    merchant: Merchant,
    name: string,
    address: string,
  ): Promise<Store> => {
    let store = await storeRepo.findOne({
      where: { merchantId: merchant.id, name },
    });
    if (!store) {
      store = await storeRepo.save(
        storeRepo.create({
          merchantId: merchant.id,
          name,
          address,
          status: 'ACTIVE',
        }),
      );
    }
    result.stores.push(store.id);
    return store;
  };

  const ensureUser = async (
    merchant: Merchant,
    store: Store | null,
    email: string,
    name: string,
    role: UserRole,
  ): Promise<User> => {
    let user = await userRepo.findOne({ where: { email } });
    if (!user) {
      user = await userRepo.save(
        userRepo.create({
          merchantId: merchant.id,
          storeId: store?.id ?? null,
          email,
          password,
          name,
          role,
          status: 'ACTIVE',
        }),
      );
    }
    result.users.push(user.id);
    return user;
  };

  const ensureProduct = async (
    merchant: Merchant,
    name: string,
    sku: string,
    price: number,
  ): Promise<Product> => {
    let product = await productRepo.findOne({
      where: { merchantId: merchant.id, sku },
    });
    if (!product) {
      product = await productRepo.save(
        productRepo.create({
          merchantId: merchant.id,
          name,
          sku,
          description: `${name} (seed data)`,
          price,
          status: 'ACTIVE',
        }),
      );
    }
    result.products.push(product.id);
    return product;
  };

  const ensureInventory = async (
    store: Store,
    product: Product,
    quantity: number,
  ): Promise<void> => {
    const inventory = await inventoryRepo.findOne({
      where: { storeId: store.id, productId: product.id },
    });
    if (!inventory) {
      await inventoryRepo.save(
        inventoryRepo.create({
          storeId: store.id,
          productId: product.id,
          quantity,
        }),
      );
    }
  };

  // ---------------------------------------------------------------- Merchant A
  const merchantA = await ensureMerchant('Merchant A');
  const storeA1 = await ensureStore(
    merchantA,
    'Merchant A - Store 1',
    '12 MG Road, Ahmedabad, Gujarat',
  );
  const storeA2 = await ensureStore(
    merchantA,
    'Merchant A - Store 2',
    '45 Satellite Road, Ahmedabad, Gujarat',
  );

  await ensureUser(
    merchantA,
    storeA1,
    'owner@merchanta.com',
    'Aarti Owner',
    UserRole.MERCHANT_ADMIN,
  );
  await ensureUser(
    merchantA,
    storeA1,
    'manager@merchanta.com',
    'Manan Manager',
    UserRole.STORE_MANAGER,
  );
  await ensureUser(
    merchantA,
    storeA1,
    'cashier@merchanta.com',
    'Chirag Cashier',
    UserRole.CASHIER,
  );
  await ensureUser(
    merchantA,
    storeA2,
    'cashier.store2@merchanta.com',
    'Divya Cashier',
    UserRole.CASHIER,
  );

  const coffee = await ensureProduct(merchantA, 'Espresso', 'ESP-001', 149.5);
  const latte = await ensureProduct(merchantA, 'Cafe Latte', 'ESP-002', 199.0);
  const cookie = await ensureProduct(
    merchantA,
    'Butter Cookie',
    'SNK-001',
    60.25,
  );
  const coldDrink = await ensureProduct(
    merchantA,
    'Cold Drink',
    'BEV-001',
    80.0,
  );

  await ensureInventory(storeA1, coffee, 50);
  await ensureInventory(storeA1, latte, 30);
  await ensureInventory(storeA1, cookie, 5); // deliberately low stock
  await ensureInventory(storeA1, coldDrink, 12);
  await ensureInventory(storeA2, coffee, 25);
  await ensureInventory(storeA2, latte, 10);
  await ensureInventory(storeA2, cookie, 40);
  await ensureInventory(storeA2, coldDrink, 8);

  // ---------------------------------------------------------------- Merchant B
  const merchantB = await ensureMerchant('Merchant B');
  const storeB3 = await ensureStore(
    merchantB,
    'Merchant B - Store 3',
    '78 Satellite Road, Ahmedabad, Gujarat',
  );

  await ensureUser(
    merchantB,
    storeB3,
    'owner@merchantb.com',
    'Bhavesh Owner',
    UserRole.MERCHANT_ADMIN,
  );
  await ensureUser(
    merchantB,
    storeB3,
    'cashier@merchantb.com',
    'Kavya Cashier',
    UserRole.CASHIER,
  );

  // Same SKU as merchant A on purpose - proves SKU scoping is per merchant.
  const burger = await ensureProduct(merchantB, 'Veg Burger', 'ESP-001', 129.0);
  const fries = await ensureProduct(merchantB, 'French Fries', 'SNK-001', 89.5);

  await ensureInventory(storeB3, burger, 40);
  await ensureInventory(storeB3, fries, 20);

  return result;
}
