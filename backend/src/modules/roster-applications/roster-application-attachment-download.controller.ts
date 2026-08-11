import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RosterApplicationAttachmentsService } from './roster-application-attachments.service';

// @Public() délibérément — même principe que
// booking-request-attachment-download.controller.ts (Phase 3b) : le token
// signé EST l'autorisation, jamais une session. Le token n'a pu être émis
// QUE par un ADMIN/SUPER_ADMIN authentifié.
@Controller('files/roster-attachments')
@Public()
export class RosterApplicationAttachmentDownloadController {
  constructor(private readonly service: RosterApplicationAttachmentsService) {}

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
