import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Merchant } from './merchant.entity';
import { Store } from './store.entity';
import { User } from './user.entity';
import { SaleItem } from './sale-item.entity';
import { PaymentStatus, SaleStatus } from '../../common/enums';
import { decimalTransformer } from '../transformers/decimal.transformer';

@Entity('sales')
@Index(['merchantId'])
@Index(['storeId'])
@Index(['userId'])
@Unique(['storeId', 'idempotencyKey'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalAmount: number;

  @Column({ type: 'varchar', default: SaleStatus.PENDING })
  status: string;

  @Column({
    name: 'payment_status',
    type: 'varchar',
    default: PaymentStatus.PENDING,
  })
  paymentStatus: string;

  @Column({ name: 'payment_reference', type: 'varchar', nullable: true })
  paymentReference: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar' })
  idempotencyKey: string;

  @Column({ name: 'payment_method', type: 'varchar', default: 'MOCK' })
  paymentMethod: string;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: false })
  items: SaleItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
