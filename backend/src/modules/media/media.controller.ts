import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { StorageService } from '../../storage/storage.service';
import { ImageProcessingService } from './image-processing.service';
import { MediaUploadResponseDto } from './dto/media-upload-response.dto';
import { PayloadTooLargeFilter } from './filters/payload-too-large.filter';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo
const MEDIA_SUBDIR = 'media';

@Controller('admin/media')
@UseFilters(PayloadTooLargeFilter)
export class MediaController {
  constructor(
    private readonly imageProcessing: ImageProcessingService,
    private readonly storage: StorageService,
  ) {}

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      // En mémoire (pas sur disque) : on a besoin d'un Buffer pour sharp,
      // et 10 Mo max tient largement en RAM sans souci.
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        // Whitelist stricte : exclut de fait le SVG (vecteur d'XSS) et le
        // HEIC (non supporté par sharp/navigateurs sans conversion).
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              `Type de fichier non autorisé : "${file.mimetype}". Formats acceptés : JPEG, PNG, WebP.`,
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MediaUploadResponseDto> {
    if (!file) {
      throw new BadRequestException(
        'Aucun fichier reçu (champ "file" attendu en multipart/form-data).',
      );
    }

    const processed = await this.imageProcessing.process(file.buffer);

    // Nom généré côté serveur, jamais celui envoyé par le client : protège
    // contre le path traversal et les collisions de noms.
    const id = randomUUID();
    const displayKey = await this.storage.savePublic(
      processed.display.buffer,
      MEDIA_SUBDIR,
      `${id}.webp`,
    );
    const thumbnailKey = await this.storage.savePublic(
      processed.thumbnail.buffer,
      MEDIA_SUBDIR,
      `${id}-thumb.webp`,
    );

    return {
      url: this.storage.getPublicUrl(displayKey),
      thumbnailUrl: this.storage.getPublicUrl(thumbnailKey),
      width: processed.display.width,
      height: processed.display.height,
      mimeType: 'image/webp',
      sizeBytes: processed.display.sizeBytes,
    };
  }
}
