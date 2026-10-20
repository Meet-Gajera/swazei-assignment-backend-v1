import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
} from './payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  /**
   * Charges the configured provider. The caller is responsible for rolling the
   * database transaction back when the outcome is FAILED.
   */
  async charge(request: PaymentRequest): Promise<PaymentResult> {
    return this.provider.charge(request);
  }
}

/**
 * Factory that selects the payment provider implementation. Swap this to plug
 * in a real provider without touching the sale service.
 */
export const paymentProviderFactory = {
  provide: PAYMENT_PROVIDER,
  useFactory: (configService: ConfigService) =>
    new MockPaymentProvider(configService),
  inject: [ConfigService],
};
