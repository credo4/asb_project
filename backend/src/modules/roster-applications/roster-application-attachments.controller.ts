import {
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
import { RosterApplicationAttachmentsService } from './roster-application-attachments.service';
import { MediaPayloadTooLargeFilter } from '../speaker-media/filters/media-payload-too-large.filter';
import { ATTACHMENT_MAX_SIZE_BYTES } from './roster-application-attachments.constants';

// Accès strictement ADMIN/SUPER_ADMIN (§5) — jamais un rôle SPEAKER, jamais
// le public, même après conversion.
@Controller('admin/roster-applications/:applicationId/attachments')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class RosterApplicationAttachmentsController {
  constructor(private readonly service: RosterApplicationAttachmentsService) {}

  @Get()
  findAll(@Param('applicationId', ParseIntPipe) applicationId: number) {
    return this.service.listForApplication(applicationId);
  }

  @Post()
  @UseFilters(MediaPayloadTooLargeFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: ATTACHMENT_MAX_SIZE_BYTES },
    }),
  )
  upload(
    @Param('applicationId', ParseIntPipe) applicationId: number,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.upload(applicationId, file, user);
  }

  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('applicationId', ParseIntPipe) applicationId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(applicationId, attachmentId, user);
  }

  @Get(':attachmentId/download-link')
  createDownloadLink(
    @Param('applicationId', ParseIntPipe) applicationId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createDownloadLink(applicationId, attachmentId, user);
  }
}
