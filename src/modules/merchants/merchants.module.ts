import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Merchant, Store, User } from '../../database/entities';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';
import { MerchantsRepository } from './merchants.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Merchant, Store, User])],
  controllers: [MerchantsController],
  providers: [MerchantsService, MerchantsRepository],
  exports: [MerchantsService, MerchantsRepository],
})
export class MerchantsModule {}
