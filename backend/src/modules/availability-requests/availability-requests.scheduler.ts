import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AvailabilityRequestsService } from './availability-requests.service';

// §3.4 — même cadence et même schéma que RemindersScheduler (booking-requests,
// Phase 3b) : `@nestjs/schedule` n'est enregistré globalement qu'une seule
// fois (`ScheduleModule.forRoot()`, app.module.ts) mais accepte plusieurs
// handlers `@Cron` indépendants dans des providers différents — une classe
// SÉPARÉE ici plutôt qu'une méthode ajoutée à RemindersScheduler, pour
// éviter une dépendance circulaire entre les modules booking-requests et
// availability-requests (AvailabilityRequestsService a besoin de
// BookingRequestsService pour la transition AWAITING_SPEAKER, §2 — le sens
// inverse aurait bouclé).
//
// ⚠️ MÊME LIMITE CONNUE que RemindersScheduler (voir CLAUDE.md/§2.6) : cette
// tâche s'exécute UNE FOIS PAR INSTANCE de l'application, sans verrou
// distribué — sans problème tant que l'app tourne en un seul exemplaire.
@Injectable()
export class AvailabilityRequestsScheduler {
  private readonly logger = new Logger(AvailabilityRequestsScheduler.name);

  constructor(private readonly service: AvailabilityRequestsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleOverdueAvailabilityRequests(): Promise<void> {
    try {
      await this.service.expireOverdueAndNotify(new Date());
    } catch (error) {
      this.logger.error(
        'Échec du traitement des sollicitations de disponibilité expirées',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
