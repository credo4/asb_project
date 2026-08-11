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
import { BookingRequestAttachmentsService } from './booking-request-attachments.service';
import { MediaPayloadTooLargeFilter } from '../speaker-media/filters/media-payload-too-large.filter';
import { ATTACHMENT_MAX_SIZE_BYTES } from './booking-request-attachments.constants';

// Accès strictement ADMIN/SUPER_ADMIN (§2.4) — jamais un rôle SPEAKER,
// jamais le public. Une DTO de type ("CV"/"OTHER"...) n'a pas de sens ici,
// contrairement à speaker_documents — juste un fichier.
@Controller('admin/booking-requests/:requestId/attachments')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class BookingRequestAttachmentsController {
  constructor(private readonly service: BookingRequestAttachmentsService) {}

  @Get()
  findAll(@Param('requestId', ParseIntPipe) requestId: number) {
    return this.service.listForRequest(requestId);
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
    @Param('requestId', ParseIntPipe) requestId: number,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.upload(requestId, file, user);
  }

  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(requestId, attachmentId, user);
  }

  @Get(':attachmentId/download-link')
  createDownloadLink(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createDownloadLink(requestId, attachmentId, user);
  }
}
