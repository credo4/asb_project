import { Module } from '@nestjs/common';
import { MailModule } from '../../mail/mail.module';
import { MediaModule } from '../media/media.module';
import { AuthModule } from '../auth/auth.module';
import { RosterApplicationsController } from './roster-applications.controller';
import { InvitationAcceptController } from './invitation-accept.controller';
import { RosterApplicationEvaluationsController } from './roster-application-evaluations.controller';
import { RosterApplicationAttachmentsController } from './roster-application-attachments.controller';
import { RosterApplicationAttachmentDownloadController } from './roster-application-attachment-download.controller';
import { RosterApplicationsService } from './roster-applications.service';
import { RosterApplicationEvaluationsService } from './roster-application-evaluations.service';
import { RosterApplicationAttachmentsService } from './roster-application-attachments.service';

// AuthModule : AuthService#issueTokenPairForUser, réutilisé par
// acceptInvitation (§4.4 — "connecte l'utilisateur", même mécanique qu'un
// login). MediaModule : FileValidationService, réutilisé pour les pièces
// jointes (magic bytes — même brique que booking-requests/speaker-documents).
@Module({
  imports: [MailModule, MediaModule, AuthModule],
  controllers: [
    RosterApplicationsController,
    InvitationAcceptController,
    RosterApplicationEvaluationsController,
    RosterApplicationAttachmentsController,
    RosterApplicationAttachmentDownloadController,
  ],
  providers: [
    RosterApplicationsService,
    RosterApplicationEvaluationsService,
    RosterApplicationAttachmentsService,
  ],
  exports: [RosterApplicationsService],
})
export class RosterApplicationsModule {}
