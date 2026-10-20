import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
} from '../payment-provider.interface';

export const MOCK_PAYMENT_PROVIDER = 'MOCK';

/**
 * A deterministic, testable mock payment provider.
 *
 * Behaviour is driven by the request:
 *  - `metadata.forceOutcome = 'SUCCESS' | 'FAILED'` forces the outcome.
 *  - `metadata.paymentToken` starting with `fail_` produces a FAILED payment.
 *  - `metadata.paymentToken` starting with `timeout_` simulates a provider
 *    timeout (the sale is rolled back).
 *  - otherwise the configured default success rate is used.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = MOCK_PAYMENT_PROVIDER;

  private readonly logger = new Logger(MockPaymentProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async charge(request: PaymentRequest): Promise<PaymentResult> {
    const forced = request.metadata?.forceOutcome as PaymentResult['outcome'];
    const token = (request.metadata?.paymentToken as string) ?? '';

    let outcome: PaymentResult['outcome'];

    if (forced === 'SUCCESS' || forced === 'FAILED') {
      outcome = forced;
    } else if (token.startsWith('fail_')) {
      outcome = 'FAILED';
    } else if (token.startsWith('timeout_')) {
      outcome = 'FAILED';
    } else {
      const successRate =
        this.configService.get<number>('payment.defaultSuccessRate') ?? 1;
      outcome = Math.random() < successRate ? 'SUCCESS' : 'FAILED';
    }

    const result: PaymentResult = {
      outcome,
      transactionId: `mock_txn_${randomUUID()}`,
      provider: this.name,
      message:
        outcome === 'SUCCESS'
          ? 'Payment captured successfully'
          : 'Payment declined by provider',
      processedAt: new Date(),
    };

    this.logger.log(
      `Mock payment ${outcome} for ref=${request.reference} amount=${request.amount}`,
    );

    return result;
  }
}
