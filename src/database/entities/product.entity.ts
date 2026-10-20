import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Merchant } from './merchant.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';

@Entity('products')
@Index(['merchantId'])
@Unique(['merchantId', 'sku'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  sku: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number;

  @Column({ type: 'varchar', default: 'ACTIVE' })
  status: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
