import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
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
import { SpeakerMediaService } from './speaker-media.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { ReorderMediaDto } from './dto/reorder-media.dto';
import { MediaPayloadTooLargeFilter } from './filters/media-payload-too-large.filter';
import { MEDIA_UPLOAD_MULTER_LIMIT_BYTES } from './speaker-media.constants';

// Aucune route ici n'accepte un id de SPEAKER fourni par l'appelant (voir
// SpeakerMediaService — resolveOwnSpeakerId dérive tout de actor.id). Les
// routes /:id acceptent un id de MÉDIA, toujours scopé par speakerId côté
// service : un id d'un autre speaker produit 404 (§2 — jamais 403).
@Controller('speaker/me/media')
@Roles(Role.SPEAKER)
export class SpeakerMediaController {
  constructor(private readonly service: SpeakerMediaService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listOwn(user);
  }

  @Post()
  @UseFilters(MediaPayloadTooLargeFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // Plafond large (voir constants.ts) : la limite précise par type
      // (10 Mo photo / 20 Mo press-kit) est revérifiée dans le service, une
      // fois `type` connu — Multer ne le connaît pas encore à ce stade.
      limits: { fileSize: MEDIA_UPLOAD_MULTER_LIMIT_BYTES },
    }),
  )
  upload(
    @Body() dto: CreateMediaDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.uploadOwn(user, dto, file);
  }

  @Patch('order')
  reorder(
    @Body() dto: ReorderMediaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reorderOwn(user, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMediaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateOwn(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeOwn(user, id);
  }
}
