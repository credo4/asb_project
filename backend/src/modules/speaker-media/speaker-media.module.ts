import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { SpeakerMediaController } from './speaker-media.controller';
import { AdminSpeakerMediaController } from './admin-speaker-media.controller';
import { SpeakerMediaService } from './speaker-media.service';

@Module({
  imports: [MediaModule],
  controllers: [SpeakerMediaController, AdminSpeakerMediaController],
  providers: [SpeakerMediaService],
  exports: [SpeakerMediaService],
})
export class SpeakerMediaModule {}
