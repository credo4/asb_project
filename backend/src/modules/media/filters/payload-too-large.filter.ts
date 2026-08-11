import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Response } from 'express';

// @nestjs/platform-express transforme déjà en interne les erreurs multer
// (MulterError) en HttpException standard AVANT qu'elles n'atteignent les
// filtres (voir FileInterceptor -> transformException()) : un @Catch(MulterError)
// ne matcherait donc jamais rien. On cible directement PayloadTooLargeException
// pour remplacer son message générique anglais par un message clair en
// français, cohérent avec le reste de l'API.
@Catch(PayloadTooLargeException)
export class PayloadTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'Fichier trop volumineux (10 Mo maximum).',
      error: 'PayloadTooLargeException',
    });
  }
}
