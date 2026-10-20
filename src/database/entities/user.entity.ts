import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Merchant } from './merchant.entity';
import { Store } from './store.entity';
import { UserRole } from '../../common/enums';

@Entity('users')
@Index(['merchantId'])
@Index(['storeId'])
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId: string | null;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', select: false })
  password: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', default: UserRole.CASHIER })
  role: string;

  @Column({ type: 'varchar', default: 'ACTIVE' })
  status: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @ManyToOne(() => Store, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
