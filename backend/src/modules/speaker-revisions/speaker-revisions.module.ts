import { Module } from '@nestjs/common';
import { MailModule } from '../../mail/mail.module';
import { SpeakerMeController } from './speaker-me.controller';
import { AdminSpeakerRevisionsController } from './admin-speaker-revisions.controller';
import { SpeakerRevisionsService } from './speaker-revisions.service';
import { SpeakerRevisionDiffService } from './speaker-revision-diff.service';
import { SpeakerRevisionPreviewService } from './speaker-revision-preview.service';

@Module({
  imports: [MailModule],
  controllers: [SpeakerMeController, AdminSpeakerRevisionsController],
  providers: [
    SpeakerRevisionsService,
    SpeakerRevisionDiffService,
    SpeakerRevisionPreviewService,
  ],
})
export class SpeakerRevisionsModule {}
