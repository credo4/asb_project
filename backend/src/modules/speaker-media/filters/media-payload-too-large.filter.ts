import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Response } from 'express';

// Même principe que modules/media/filters/payload-too-large.filter.ts, avec
// le message adapté au plafond Multer réel de ce module (20 Mo, le plus
// large des deux types acceptés — voir speaker-media.constants.ts).
@Catch(PayloadTooLargeException)
export class MediaPayloadTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'Fichier trop volumineux (20 Mo maximum).',
      error: 'PayloadTooLargeException',
    });
  }
}
