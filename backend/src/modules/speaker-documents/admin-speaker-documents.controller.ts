import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { SpeakerDocumentsService } from './speaker-documents.service';

// Deux racines d'URL distinctes (nested sous /admin/speakers/ pour la liste,
// /admin/speaker-documents/ pour le lien de téléchargement — cf. §7) : pas
// de préfixe @Controller() commun, chemins complets par méthode.
@Controller()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminSpeakerDocumentsController {
  constructor(private readonly service: SpeakerDocumentsService) {}

  @Get('admin/speakers/:speakerId/documents')
  findAllForSpeaker(@Param('speakerId', ParseIntPipe) speakerId: number) {
    return this.service.listForAdmin(speakerId);
  }

  @Get('admin/speaker-documents/:id/download-link')
  createDownloadLink(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createAdminDownloadLink(user, id);
  }
}
