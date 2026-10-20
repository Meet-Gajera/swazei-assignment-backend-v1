import { Module } from '@nestjs/common';
import { PaymentsService, paymentProviderFactory } from './payments.service';

@Module({
  providers: [PaymentsService, paymentProviderFactory],
  exports: [PaymentsService],
})
export class PaymentsModule {}
