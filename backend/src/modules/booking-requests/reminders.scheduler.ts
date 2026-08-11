import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { RemindersService } from './reminders.service';

// ⚠️ LIMITE CONNUE, documentée ici volontairement (§2.6) : cette tâche
// planifiée s'exécute UNE FOIS PAR INSTANCE de l'application. Tant que
// l'app tourne en un seul exemplaire (le cas aujourd'hui — voir
// CLAUDE.md/DEPLOYMENT.md), chaque rappel/signalement n'est envoyé qu'une
// fois par heure, ce qui est le comportement voulu. Le jour où l'app sera
// déployée en PLUSIEURS exemplaires (scaling horizontal), CHAQUE instance
// exécutera cette même tâche à la même heure : sans verrou distribué (ex.
// un lock Redis, ou une colonne "lease" en base), les emails partiraient en
// double, une fois par instance. Pas construit ici — on ne sur-conçoit pas
// une limite qui ne s'applique pas au déploiement actuel.
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: RemindersService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleDueRemindersAndOverdueRequests(): Promise<void> {
    const now = new Date();
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';

    await this.sendDueReminders(now, frontendUrl);
    await this.signalOverdueRequests(now, frontendUrl);
  }

  private async sendDueReminders(
    now: Date,
    frontendUrl: string,
  ): Promise<void> {
    const due = await this.reminders.findDue(now);

    for (const reminder of due) {
      if (!reminder.assignedTo) continue; // pas de destinataire, rien à envoyer
      try {
        await this.mailService.sendBookingRequestReminder({
          to: reminder.assignedTo.email,
          reference: reminder.request.reference,
          message: reminder.message,
          backOfficeUrl: `${frontendUrl}/booking-requests/${reminder.request.id}`,
        });
      } catch (error) {
        this.logger.error(
          `Échec de l'email de rappel #${reminder.id} pour ${reminder.request.reference}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }

  private async signalOverdueRequests(
    now: Date,
    frontendUrl: string,
  ): Promise<void> {
    // isOverdue (§2.5), exprimé directement en SQL — même définition que
    // BookingRequestsService (responseDueAt dépassé ET aucune première
    // réponse) — restreint aux demandes ASSIGNÉES (sinon, à qui signaler ?).
    const overdue = await this.prisma.bookingRequest.findMany({
      where: {
        responseDueAt: { lt: now },
        firstRespondedAt: null,
        assignedAdminId: { not: null },
      },
      select: {
        id: true,
        reference: true,
        assignedAdmin: { select: { email: true } },
      },
    });

    for (const request of overdue) {
      if (!request.assignedAdmin) continue;
      try {
        await this.mailService.sendBookingRequestReminder({
          to: request.assignedAdmin.email,
          reference: request.reference,
          message: 'Cette demande est en retard (délai de réponse dépassé).',
          backOfficeUrl: `${frontendUrl}/booking-requests/${request.id}`,
        });
      } catch (error) {
        this.logger.error(
          `Échec du signalement de retard pour ${request.reference}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }
}
