import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory, Sale, SaleItem } from '../../database/entities';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SalesRepository } from './sales.repository';
import { ProductsModule } from '../products/products.module';
import { StoresModule } from '../stores/stores.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { QueueModule } from '../queue/queue.module';
import { SaleEventConsumer } from './sale-event.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, Inventory]),
    ProductsModule,
    StoresModule,
    InventoryModule,
    PaymentsModule,
    QueueModule,
  ],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository, SaleEventConsumer],
  exports: [SalesService, SalesRepository],
})
export class SalesModule {}
