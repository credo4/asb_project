import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SpeakerDocumentsService } from './speaker-documents.service';

// @Public() délibérément : c'est TOUT le principe d'un lien signé — il doit
// pouvoir s'ouvrir directement dans un onglet de navigateur (clic sur
// "Télécharger"), sans en-tête Authorization. L'autorisation est prouvée par
// le token lui-même (signature HMAC + expiration), pas par une session —
// voir SpeakerDocumentsService#resolveDownload.
@Controller('files/documents')
@Public()
export class DocumentDownloadController {
  constructor(private readonly service: SpeakerDocumentsService) {}

  @Get('download')
  async download(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!token) {
      throw new BadRequestException('Paramètre "token" manquant.');
    }

    const { document, stream } = await this.service.resolveDownload(token);

    // Nom affiché nettoyé (jamais utilisé pour un chemin disque, juste pour
    // l'en-tête) : on retire guillemets/retours à la ligne (injection
    // d'en-tête), et on fournit en plus la forme UTF-8 (RFC 5987) pour les
    // noms de fichiers avec accents.
    const safeName = document.originalFilename.replace(/["\r\n]/g, '');
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(document.originalFilename)}`,
    );

    // `stream.pipe(res)`, jamais un `readFile` en mémoire suivi d'un
    // `res.send(buffer)` : voir l'explication donnée à l'utilisateur — pour
    // un fichier de 20 Mo, la différence est le pic mémoire par requête
    // concurrente et le délai avant le premier octet envoyé au client.
    stream.pipe(res);
  }
}
