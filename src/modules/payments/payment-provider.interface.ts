export interface PaymentRequest {
  amount: number;
  currency?: string;
  reference: string;
  metadata?: Record<string, unknown>;
}

export type PaymentOutcome = 'SUCCESS' | 'FAILED';

export interface PaymentResult {
  outcome: PaymentOutcome;
  transactionId: string;
  provider: string;
  message: string;
  processedAt: Date;
}

/**
 * The payment abstraction. The order/sale flow only depends on this
 * interface, so swapping the mock for Stripe/Adyen/Razorpay is a matter of
 * providing another implementation - no change to the domain logic.
 */
export interface PaymentProvider {
  readonly name: string;
  charge(request: PaymentRequest): Promise<PaymentResult>;
}
