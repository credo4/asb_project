import { Module } from '@nestjs/common';
import { SpeakerAvailabilityController } from './speaker-availability.controller';
import { AdminSpeakerAvailabilityController } from './admin-speaker-availability.controller';
import { SpeakerAvailabilityService } from './speaker-availability.service';

// SpeakerAvailabilityService est exporté : SpeakersModule l'importe pour
// exposer GET /admin/speakers/available directement sur SpeakersController
// (voir le commentaire dans speakers.controller.ts — c'est une contrainte de
// routage, pas une dépendance métier réelle entre les deux domaines).
@Module({
  controllers: [
    SpeakerAvailabilityController,
    AdminSpeakerAvailabilityController,
  ],
  providers: [SpeakerAvailabilityService],
  exports: [SpeakerAvailabilityService],
})
export class SpeakerAvailabilityModule {}
