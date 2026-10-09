import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from '../../contract/api';

interface HttpExceptionBody {
  code?: string;
  message?: string | string[];
  details?: Record<string, unknown>;
  error?: string;
}

/** Renders every failure as the `ApiErrorBody` shape the clients expect. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    // `getStatus()` is typed as a plain number; naming the enum here keeps every
    // comparison below type-safe instead of number-against-enum.
    const status: HttpStatus =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.buildBody(exception, status, request);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} failed: ${body.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    response.status(status).json(body);
  }

  private buildBody(exception: unknown, status: HttpStatus, request: Request): ApiErrorBody {
    const base = { statusCode: status, timestamp: new Date().toISOString(), path: request.url };
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { ...base, code: this.fallbackCode(status), message: payload };
      }
      const typed = payload as HttpExceptionBody;
      const message = Array.isArray(typed.message)
        ? typed.message.join('; ')
        : (typed.message ?? exception.message);
      return {
        ...base,
        code: typed.code ?? this.fallbackCode(status),
        message,
        details: Array.isArray(typed.message) ? { validation: typed.message } : typed.details,
      };
    }
    return { ...base, code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' };
  }

  private fallbackCode(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_FAILED';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'PERMISSION_DENIED';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'PAYLOAD_TOO_LARGE';
      default:
        return 'HTTP_ERROR';
    }
  }
}
