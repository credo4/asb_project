import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MissionDocumentsService } from './mission-documents.service';

// @Public() délibérément — même principe que DocumentDownloadController
// (speaker-documents, Phase 2c) : un lien signé doit s'ouvrir directement
// dans un onglet, sans en-tête Authorization. L'autorisation est prouvée
// par le token lui-même (signature HMAC + expiration), pas par une session.
@Controller('files/mission-documents')
@Public()
export class MissionDocumentDownloadController {
  constructor(private readonly service: MissionDocumentsService) {}

  @Get('download')
  async download(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!token) {
      throw new BadRequestException('Paramètre "token" manquant.');
    }

    const { document, stream } = await this.service.resolveDownload(token);

    const safeName = document.originalFilename.replace(/["\r\n]/g, '');
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(document.originalFilename)}`,
    );

    stream.pipe(res);
  }
}
