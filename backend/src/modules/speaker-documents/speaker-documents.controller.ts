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
import { SpeakerDocumentsService } from './speaker-documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { MediaPayloadTooLargeFilter } from '../speaker-media/filters/media-payload-too-large.filter';
import { DOCUMENT_MAX_SIZE_BYTES } from './speaker-documents.constants';

// Même règle de scoping que speaker-media (§2) : aucune route n'accepte de
// speakerId fourni par l'appelant, et /:id est toujours filtré par
// speakerId côté service — un document d'un autre speaker produit 404.
@Controller('speaker/me/documents')
@Roles(Role.SPEAKER)
export class SpeakerDocumentsController {
  constructor(private readonly service: SpeakerDocumentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listOwn(user);
  }

  @Post()
  @UseFilters(MediaPayloadTooLargeFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: DOCUMENT_MAX_SIZE_BYTES },
    }),
  )
  upload(
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.uploadOwn(user, dto, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeOwn(user, id);
  }

  @Get(':id/download-link')
  createDownloadLink(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createOwnDownloadLink(user, id);
  }
}
