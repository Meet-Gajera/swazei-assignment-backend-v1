import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Extracts the idempotency key of a write request.
 *
 * The key may be supplied through the `Idempotency-Key` header (preferred,
 * this is what a POS terminal sends) or through an `idempotencyKey` field in
 * the request body.
 */
export const IdempotencyKey = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { body?: Record<string, unknown> }>();
    const header = request.headers['idempotency-key'];
    const headerValue = Array.isArray(header) ? header[0] : header;
    const bodyValue = request.body?.idempotencyKey;

    const key =
      (typeof headerValue === 'string' ? headerValue : undefined) ??
      (typeof bodyValue === 'string' ? bodyValue : undefined);

    if (!key || !key.trim()) {
      throw new BadRequestException(
        'An Idempotency-Key header (or idempotencyKey body field) is required',
      );
    }

    return key.trim();
  },
);
