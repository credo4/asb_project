import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { ImageProcessingService } from './image-processing.service';
import { FileValidationService } from './file-validation.service';

@Module({
  controllers: [MediaController],
  providers: [ImageProcessingService, FileValidationService],
  // Exportés : réutilisés par speaker-media (photos/press-kits) et
  // speaker-documents (PDF) plutôt que de dupliquer sharp/file-type ailleurs.
  exports: [ImageProcessingService, FileValidationService],
})
export class MediaModule {}
