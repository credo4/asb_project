import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { MissionDocumentsService } from './mission-documents.service';
import { MediaPayloadTooLargeFilter } from '../speaker-media/filters/media-payload-too-large.filter';
import { CreateMissionDocumentDto } from './dto/create-mission-document.dto';
import { MISSION_DOCUMENT_MAX_SIZE_BYTES } from './mission-documents.constants';

// §6/§7 — dépôt de documents (présentation, facture, contrat signé,
// informations de voyage). Voit uniquement isSharedWithSpeaker=true ET ce
// qu'il a lui-même déposé (voir MissionDocumentsService#listForSpeaker).
// Scoping via resolveOwnSpeakerId, 404 sur la mission d'un autre speaker.
@Controller('speaker/me/missions/:missionId/documents')
@Roles(Role.SPEAKER)
export class SpeakerMissionDocumentsController {
  constructor(private readonly service: MissionDocumentsService) {}

  @Get()
  findAll(
    @Param('missionId', ParseIntPipe) missionId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listForSpeaker(user, missionId);
  }

  @Post()
  @UseFilters(MediaPayloadTooLargeFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MISSION_DOCUMENT_MAX_SIZE_BYTES },
    }),
  )
  upload(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Body() dto: CreateMissionDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.uploadForSpeaker(user, missionId, dto, file);
  }

  @Get(':documentId/download-link')
  createDownloadLink(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createOwnDownloadLink(user, missionId, documentId);
  }
}
