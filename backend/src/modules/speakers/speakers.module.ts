import { Module } from '@nestjs/common';
import { SpeakerAvailabilityModule } from '../speaker-availability/speaker-availability.module';
import { SpeakersController } from './speakers.controller';
import { SpeakersService } from './speakers.service';

// Importe SpeakerAvailabilityModule uniquement pour que SpeakersController
// puisse déléguer GET /admin/speakers/available à
// SpeakerAvailabilityService — voir le commentaire dans speakers.controller.ts
// (contrainte de routage : cette route littérale doit s'enregistrer dans le
// même contrôleur que `:id` pour ne jamais en dépendre l'ordre d'import).
@Module({
  imports: [SpeakerAvailabilityModule],
  controllers: [SpeakersController],
  providers: [SpeakersService],
})
export class SpeakersModule {}
