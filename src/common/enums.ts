/**
 * Shared domain enums / constants.
 */
export enum UserRole {
  MERCHANT_ADMIN = 'MERCHANT_ADMIN',
  STORE_MANAGER = 'STORE_MANAGER',
  CASHIER = 'CASHIER',
}

export enum SaleStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum PaymentMethod {
  MOCK = 'MOCK',
}
