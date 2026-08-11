import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

// Format d'erreur homogène exigé par CLAUDE.md : { statusCode, message, error }.
// `@Catch()` sans argument intercepte TOUTES les exceptions (pas seulement les
// HttpException Nest), pour ne jamais laisser fuiter une stack trace brute.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, error } = this.extractMessage(exception, isHttpException);

    if (!isHttpException) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(statusCode).json({ statusCode, message, error });
  }

  private extractMessage(
    exception: unknown,
    isHttpException: boolean,
  ): { message: string | string[]; error: string } {
    if (isHttpException) {
      const httpException = exception as HttpException;
      const body = httpException.getResponse();

      // class-validator renvoie { message: string[], error: string } via le
      // ValidationPipe : on préserve ce détail plutôt que de l'écraser.
      if (typeof body === 'object' && body !== null && 'message' in body) {
        const typedBody = body as {
          message: string | string[];
          error?: string;
        };
        return {
          message: typedBody.message,
          error: typedBody.error ?? httpException.name,
        };
      }

      return { message: httpException.message, error: httpException.name };
    }

    return {
      message: 'Erreur interne du serveur',
      error: 'InternalServerError',
    };
  }
}
