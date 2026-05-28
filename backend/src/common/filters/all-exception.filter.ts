import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (this.isCriticalError(exception)) {
      this.logger.error(
        `Critical Error: ${exception.message}`,
        exception.stack,
      );
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    if (this.isValidationError(exception)) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Validation error for ${exception[0].property}`,
        errors: exception,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    const { status, message, errorDetails } =
      this.resolveErrorDetails(exception);

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      const errMsg = exception instanceof Error ? exception.message : 'Unknown';
      this.logger.error(
        `Unexpected Error: ${errMsg}`,
        typeof exception === 'object' && exception !== null
          ? JSON.stringify(exception)
          : String(exception as string),
      );
    }

    return response.status(status).json({
      success: false,
      message,
      errors: errorDetails,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private isCriticalError(exception: unknown): exception is Error {
    return (
      exception instanceof TypeError ||
      exception instanceof RangeError ||
      exception instanceof ReferenceError ||
      exception instanceof SyntaxError ||
      exception instanceof EvalError
    );
  }

  private isValidationError(
    exception: unknown,
  ): exception is [ValidationError, ...ValidationError[]] {
    return (
      Array.isArray(exception) &&
      exception.length > 0 &&
      exception[0] instanceof ValidationError
    );
  }

  private isDatabaseException(
    exception: unknown,
  ): exception is Record<string, unknown> {
    return (
      typeof exception === 'object' && exception !== null && 'code' in exception
    );
  }

  private resolveErrorDetails(exception: unknown): {
    status: number;
    message: string;
    errorDetails: unknown;
  } {
    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorDetails: unknown = null;

    if (exception instanceof HttpException) {
      const details = this.handleHttpException(exception);
      status = details.status;
      message = details.message;
      errorDetails = details.errorDetails;
    } else if (this.isDatabaseException(exception)) {
      const details = this.handleDbException(exception);
      status = details.status;
      message = details.message;
    }

    return { status, message, errorDetails };
  }

  private handleHttpException(exception: HttpException) {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    let message = 'Internal server error';
    let errorDetails: unknown = null;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      const resMessage = (exceptionResponse as Record<string, unknown>).message;
      message = Array.isArray(resMessage)
        ? resMessage.join(', ')
        : String(resMessage);
      errorDetails = (exceptionResponse as Record<string, unknown>).error;
    }
    return { status, message, errorDetails };
  }

  private handleDbException(exception: Record<string, unknown>) {
    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database operation failed';
    const code = exception.code;

    if (code === '22P02') {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid input syntax for database query';
    } else if (code === '23505' || code === 'P2002') {
      status = HttpStatus.CONFLICT;
      message = 'Duplicate entry violation';
    } else if (code === '23503' || code === 'P2003') {
      status = HttpStatus.BAD_REQUEST;
      message = 'Foreign key constraint violation';
    } else if (code === 'P2025') {
      status = HttpStatus.NOT_FOUND;
      message = 'Requested record was not found';
    } else {
      const errMsg = exception instanceof Error ? exception.message : 'Unknown';
      const errStack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `Database Error [${String(code)}]: ${errMsg}`,
        errStack,
      );
    }
    return { status, message };
  }
}
