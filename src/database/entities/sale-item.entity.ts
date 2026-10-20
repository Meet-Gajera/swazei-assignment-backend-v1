import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Sale } from './sale.entity';
import { Product } from './product.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';

@Entity('sale_items')
@Index(['saleId'])
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sale_id', type: 'uuid' })
  saleId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  /** Snapshotted at sale time so historic orders never change. */
  @Column({ name: 'product_name', type: 'varchar' })
  productName: string;

  @Column({ type: 'varchar' })
  sku: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice: number;

  @Column({
    name: 'line_total',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  lineTotal: number;

  @ManyToOne(() => Sale, (sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
