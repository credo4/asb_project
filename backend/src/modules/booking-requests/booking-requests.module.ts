import { Module } from '@nestjs/common';
import { MailModule } from '../../mail/mail.module';
import { ClientsModule } from '../clients/clients.module';
import { MediaModule } from '../media/media.module';
import { BookingRequestsController } from './booking-requests.controller';
import { BookingRequestNotesController } from './booking-request-notes.controller';
import { BookingRequestAttachmentsController } from './booking-request-attachments.controller';
import { BookingRequestAttachmentDownloadController } from './booking-request-attachment-download.controller';
import { RemindersController } from './reminders.controller';
import { BookingRequestsService } from './booking-requests.service';
import { BookingRequestNotesService } from './booking-request-notes.service';
import { BookingRequestAttachmentsService } from './booking-request-attachments.service';
import { RemindersService } from './reminders.service';
import { RemindersScheduler } from './reminders.scheduler';

// ClientsModule : rattachement automatique à la création (§A3) et
// PATCH :id/link (§A5) — voir ClientLinkingService.
// MediaModule : FileValidationService, réutilisé pour les pièces jointes
// (§2.4 — magic bytes, même brique que speaker-documents).
@Module({
  imports: [MailModule, ClientsModule, MediaModule],
  controllers: [
    BookingRequestsController,
    BookingRequestNotesController,
    BookingRequestAttachmentsController,
    BookingRequestAttachmentDownloadController,
    RemindersController,
  ],
  providers: [
    BookingRequestsService,
    BookingRequestNotesService,
    BookingRequestAttachmentsService,
    RemindersService,
    RemindersScheduler,
  ],
  exports: [BookingRequestsService],
})
export class BookingRequestsModule {}
