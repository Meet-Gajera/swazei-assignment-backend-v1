import { ConfigService } from '@nestjs/config';
import { MockPaymentProvider } from './mock-payment.provider';

describe('MockPaymentProvider', () => {
  const configService = {
    get: jest.fn().mockReturnValue(1),
  } as unknown as ConfigService;

  let provider: MockPaymentProvider;

  beforeEach(() => {
    provider = new MockPaymentProvider(configService);
  });

  it('approves a payment by default', async () => {
    const result = await provider.charge({
      amount: 100,
      reference: 'sale-1',
    });

    expect(result.outcome).toBe('SUCCESS');
    expect(result.provider).toBe('MOCK');
    expect(result.transactionId).toMatch(/^mock_txn_/);
  });

  it('declines a payment when the token starts with fail_', async () => {
    const result = await provider.charge({
      amount: 100,
      reference: 'sale-2',
      metadata: { paymentToken: 'fail_card' },
    });

    expect(result.outcome).toBe('FAILED');
  });

  it('honours an explicitly forced outcome', async () => {
    const failed = await provider.charge({
      amount: 100,
      reference: 'sale-3',
      metadata: { forceOutcome: 'FAILED' },
    });
    const success = await provider.charge({
      amount: 100,
      reference: 'sale-4',
      metadata: { forceOutcome: 'SUCCESS' },
    });

    expect(failed.outcome).toBe('FAILED');
    expect(success.outcome).toBe('SUCCESS');
  });

  it('never returns the same transaction id twice', async () => {
    const first = await provider.charge({ amount: 10, reference: 'a' });
    const second = await provider.charge({ amount: 10, reference: 'a' });

    expect(first.transactionId).not.toBe(second.transactionId);
  });
});
