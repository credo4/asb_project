import { Module } from '@nestjs/common';
import { MailModule } from '../../mail/mail.module';
import { BookingRequestsModule } from '../booking-requests/booking-requests.module';
import { AvailabilityRequestsController } from './availability-requests.controller';
import { SpeakerOpportunitiesController } from './speaker-opportunities.controller';
import { AvailabilityRequestsService } from './availability-requests.service';
import { AvailabilityRequestsScheduler } from './availability-requests.scheduler';

// BookingRequestsModule (exporte BookingRequestsService) : réutilisé TEL
// QUEL pour la transition AWAITING_SPEAKER (§2 — jamais une écriture
// directe qui contournerait la matrice de la 3b). Dépendance UNIDIRECTIONNELLE
// (availability-requests -> booking-requests) : voir le commentaire dans
// availability-requests.scheduler.ts pour pourquoi l'expiration planifiée vit
// dans SA PROPRE classe plutôt que dans RemindersScheduler (booking-requests) —
// l'inverse aurait créé une dépendance circulaire entre les deux modules.
@Module({
  imports: [MailModule, BookingRequestsModule],
  controllers: [AvailabilityRequestsController, SpeakerOpportunitiesController],
  providers: [AvailabilityRequestsService, AvailabilityRequestsScheduler],
  exports: [AvailabilityRequestsService],
})
export class AvailabilityRequestsModule {}
