import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, map } from 'rxjs';

/**
 * Wraps every successful response in a consistent envelope:
 *   { success: true, data: ..., meta?: ... }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  { success: boolean; data: T; meta?: unknown }
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{ success: boolean; data: T; meta?: unknown }> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // Pagination results already carry their own envelope.
        if (
          data &&
          typeof data === 'object' &&
          'items' in (data as Record<string, unknown>) &&
          'meta' in (data as Record<string, unknown>)
        ) {
          return {
            success: true,
            ...(data as Record<string, unknown>),
          } as unknown as { success: boolean; data: T; meta?: unknown };
        }

        const body: { success: boolean; data: T; meta?: unknown } = {
          success: true,
          data: data === undefined ? null : data,
        };
        if (response?.statusCode === 201) {
          body.meta = { statusCode: 201 };
        }
        return body;
      }),
    );
  }
}
