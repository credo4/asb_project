import { Module } from '@nestjs/common';
import { MailModule } from '../../mail/mail.module';
import { ClientsModule } from '../clients/clients.module';
import { MediaModule } from '../media/media.module';
import { SpeakerAvailabilityModule } from '../speaker-availability/speaker-availability.module';
import { BookingRequestsController } from './booking-requests.controller';
import { BookingRequestNotesController } from './booking-request-notes.controller';
import { BookingRequestAttachmentsController } from './booking-request-attachments.controller';
import { BookingRequestAttachmentDownloadController } from './booking-request-attachment-download.controller';
import { RemindersController } from './reminders.controller';
import { MatchingController } from './matching.controller';
import { BookingRequestSpeakersController } from './booking-request-speakers.controller';
import { BookingRequestsService } from './booking-requests.service';
import { BookingRequestNotesService } from './booking-request-notes.service';
import { BookingRequestAttachmentsService } from './booking-request-attachments.service';
import { RemindersService } from './reminders.service';
import { RemindersScheduler } from './reminders.scheduler';
import { MatchingService } from './matching.service';
import { BookingRequestSpeakersService } from './booking-request-speakers.service';

// ClientsModule : rattachement automatique à la création (§A3) et
// PATCH :id/link (§A5) — voir ClientLinkingService.
// MediaModule : FileValidationService, réutilisé pour les pièces jointes
// (§2.4 — magic bytes, même brique que speaker-documents).
// SpeakerAvailabilityModule (Phase 3d) : MatchingService réutilise
// SpeakerAvailabilityService#checkAvailability() TEL QUEL — voir §1 du
// prompt matching, aucune logique de dates/déplacement réimplémentée ici.
@Module({
  imports: [MailModule, ClientsModule, MediaModule, SpeakerAvailabilityModule],
  controllers: [
    BookingRequestsController,
    BookingRequestNotesController,
    BookingRequestAttachmentsController,
    BookingRequestAttachmentDownloadController,
    RemindersController,
    MatchingController,
    BookingRequestSpeakersController,
  ],
  providers: [
    BookingRequestsService,
    BookingRequestNotesService,
    BookingRequestAttachmentsService,
    RemindersService,
    RemindersScheduler,
    MatchingService,
    BookingRequestSpeakersService,
  ],
  exports: [BookingRequestsService],
})
export class BookingRequestsModule {}
