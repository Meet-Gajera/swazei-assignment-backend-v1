import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ErrorCode } from '../errors/app.exception';

/**
 * Global exception filter: converts every thrown error into a single,
 * predictable error envelope so API consumers never have to guess the shape.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        message = payload;
        code =
          status === HttpStatus.BAD_REQUEST
            ? ErrorCode.VALIDATION_ERROR
            : ErrorCode.INTERNAL_ERROR;
      } else if (payload && typeof payload === 'object') {
        const body = payload as Record<string, unknown>;
        message = (body.message as string) ?? exception.message;
        code = (body.code as string) ?? mapStatusToCode(status);
        details = body.details;
      }
    } else if (exception instanceof QueryFailedError) {
      // Unique / FK constraint violations surface as 409 conflicts.
      status = HttpStatus.CONFLICT;
      code = ErrorCode.CONFLICT;
      message = extractConstraintMessage(exception);
      details = { driverError: exception.driverError };
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${status} ${code}: ${message}`,
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCode.VALIDATION_ERROR;
    case HttpStatus.UNAUTHORIZED:
      return ErrorCode.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ErrorCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ErrorCode.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ErrorCode.CONFLICT;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

function extractConstraintMessage(exception: QueryFailedError): string {
  const driverError = exception.driverError as {
    constraint?: string;
    code?: string;
  };
  if (driverError?.constraint) {
    return `Database constraint violated: ${driverError.constraint}`;
  }
  return 'Database constraint violated';
}
