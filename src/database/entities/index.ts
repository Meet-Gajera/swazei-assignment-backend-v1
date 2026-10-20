export * from './merchant.entity';
export * from './store.entity';
export * from './user.entity';
export * from './product.entity';
export * from './inventory.entity';
export * from './sale.entity';
export * from './sale-item.entity';
export * from './outbox-event.entity';

import { Merchant } from './merchant.entity';
import { Store } from './store.entity';
import { User } from './user.entity';
import { Product } from './product.entity';
import { Inventory } from './inventory.entity';
import { Sale } from './sale.entity';
import { SaleItem } from './sale-item.entity';
import { OutboxEvent } from './outbox-event.entity';

export const ALL_ENTITIES = [
  Merchant,
  Store,
  User,
  Product,
  Inventory,
  Sale,
  SaleItem,
  OutboxEvent,
];
