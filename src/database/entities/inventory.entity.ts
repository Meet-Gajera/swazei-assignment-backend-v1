import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  VersionColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { Product } from './product.entity';

@Entity('inventories')
@Unique(['storeId', 'productId'])
@Index(['storeId'])
@Index(['productId'])
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  /** Optimistic locking counter, incremented on every inventory write. */
  @VersionColumn({ default: 1 })
  version: number;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
