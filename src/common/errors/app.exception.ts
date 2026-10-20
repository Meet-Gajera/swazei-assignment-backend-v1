import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Application level error codes. These are stable, machine readable identifiers
 * returned in the `code` field of every error response.
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CROSS_TENANT_ACCESS = 'CROSS_TENANT_ACCESS',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INSUFFICIENT_INVENTORY = 'INSUFFICIENT_INVENTORY',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  IDEMPOTENCY_KEY_REQUIRED = 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_KEY_REUSED = 'IDEMPOTENCY_KEY_REUSED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface ErrorPayload {
  code: ErrorCode | string;
  message: string;
  details?: unknown;
}

/**
 * Base exception for all business errors thrown by the domain layer.
 * Services never throw raw HTTP exceptions - they throw these, and the global
 * exception filter translates them into a consistent JSON envelope.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    code: ErrorCode | string,
    message: string,
    details?: unknown,
  ) {
    const payload: ErrorPayload = { code, message, details };
    super(payload, status);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
      message,
      details,
    );
  }

  static unauthorized(message = 'Authentication required') {
    return new AppException(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.UNAUTHORIZED,
      message,
    );
  }

  static forbidden(
    message = 'You do not have permission to perform this action',
    code: ErrorCode | string = ErrorCode.FORBIDDEN,
  ) {
    return new AppException(HttpStatus.FORBIDDEN, code, message);
  }

  static notFound(resource = 'Resource') {
    return new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCode.NOT_FOUND,
      `${resource} not found`,
    );
  }

  static conflict(message: string, details?: unknown) {
    return new AppException(
      HttpStatus.CONFLICT,
      ErrorCode.CONFLICT,
      message,
      details,
    );
  }
}
