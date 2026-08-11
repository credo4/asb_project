import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { BookingRequestAttachmentsService } from './booking-request-attachments.service';

// @Public() délibérément, même principe que
// speaker-documents/document-download.controller.ts : c'est TOUT le
// principe d'un lien signé — l'autorisation est prouvée par le token
// lui-même (signature HMAC + expiration), jamais par une session. Le token
// n'a pu être émis QUE par un ADMIN/SUPER_ADMIN authentifié (voir
// BookingRequestAttachmentsController) — cette route ne relâche PAS
// l'invariant "strictement admin" du §2.4, elle en est le prolongement.
@Controller('files/booking-attachments')
@Public()
export class BookingRequestAttachmentDownloadController {
  constructor(private readonly service: BookingRequestAttachmentsService) {}

  @Get('download')
  async download(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!token) {
      throw new BadRequestException('Paramètre "token" manquant.');
    }

    const { attachment, stream } = await this.service.resolveDownload(token);

    const safeName = attachment.originalFilename.replace(/["\r\n]/g, '');
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(attachment.originalFilename)}`,
    );

    stream.pipe(res);
  }
}
