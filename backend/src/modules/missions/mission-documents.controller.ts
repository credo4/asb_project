import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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

// §7 — l'admin voit TOUT. Accès strictement ADMIN/SUPER_ADMIN.
@Controller('admin/missions/:missionId/documents')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class MissionDocumentsController {
  constructor(private readonly service: MissionDocumentsService) {}

  @Get()
  findAll(@Param('missionId', ParseIntPipe) missionId: number) {
    return this.service.listForAdmin(missionId);
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
    return this.service.uploadForAdmin(missionId, dto, file, user);
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(missionId, documentId, user);
  }

  @Get(':documentId/download-link')
  createDownloadLink(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createAdminDownloadLink(missionId, documentId, user);
  }
}
