import { Module } from '@nestjs/common';
import { MailModule } from '../../mail/mail.module';
import { MediaModule } from '../media/media.module';
import { CreateMissionController } from './create-mission.controller';
import { MissionsController } from './missions.controller';
import { SpeakerMissionsController } from './speaker-missions.controller';
import { MissionChecklistController } from './mission-checklist.controller';
import { MissionDocumentsController } from './mission-documents.controller';
import { SpeakerMissionDocumentsController } from './speaker-mission-documents.controller';
import { MissionDocumentDownloadController } from './mission-document-download.controller';
import { MissionMessagesController } from './mission-messages.controller';
import { SpeakerMissionMessagesController } from './speaker-mission-messages.controller';
import { MissionsService } from './missions.service';
import { MissionChecklistService } from './mission-checklist.service';
import { MissionDocumentsService } from './mission-documents.service';
import { MissionMessagesService } from './mission-messages.service';

// MediaModule : FileValidationService, réutilisé pour les documents de
// mission (§7 — magic bytes, même brique que booking-request-attachments
// et speaker-documents). Dernière étape de la Phase 3 — aucun module
// financier importé (facturation/paiements en ligne restent v2).
@Module({
  imports: [MailModule, MediaModule],
  controllers: [
    CreateMissionController,
    MissionsController,
    SpeakerMissionsController,
    MissionChecklistController,
    MissionDocumentsController,
    SpeakerMissionDocumentsController,
    MissionDocumentDownloadController,
    MissionMessagesController,
    SpeakerMissionMessagesController,
  ],
  providers: [
    MissionsService,
    MissionChecklistService,
    MissionDocumentsService,
    MissionMessagesService,
  ],
})
export class MissionsModule {}
