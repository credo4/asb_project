import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { SpeakerDocumentsController } from './speaker-documents.controller';
import { AdminSpeakerDocumentsController } from './admin-speaker-documents.controller';
import { DocumentDownloadController } from './document-download.controller';
import { SpeakerDocumentsService } from './speaker-documents.service';

@Module({
  imports: [MediaModule],
  controllers: [
    SpeakerDocumentsController,
    AdminSpeakerDocumentsController,
    DocumentDownloadController,
  ],
  providers: [SpeakerDocumentsService],
  exports: [SpeakerDocumentsService],
})
export class SpeakerDocumentsModule {}
