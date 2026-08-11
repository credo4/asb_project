import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import * as Handlebars from 'handlebars';
import { EmailDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type TemplateName =
  | 'email-verification'
  | 'password-reset'
  | 'booking-request-team-notification'
  | 'booking-request-acknowledgment'
  | 'booking-request-assigned'
  | 'booking-request-reminder'
  | 'roster-application-team-notification'
  | 'roster-application-acknowledgment'
  | 'roster-application-info-requested'
  | 'roster-application-rejected'
  | 'roster-application-invitation'
  | 'speaker-revision-team-notification'
  | 'speaker-revision-approved'
  | 'speaker-revision-changes-requested'
  | 'speaker-revision-rejected';

// `relatedEntityId` est optionnel PARTOUT (voir sendAndLog) : certains
// appels n'ont simplement rien à lier (ex. vérification d'email, avant
// même qu'un profil existe) — le journal reste utile même sans ce lien,
// juste moins précisément rattachable à une fiche précise.
interface RelatableInput {
  relatedEntityId?: number;
}

export interface BookingRequestTeamNotificationInput extends RelatableInput {
  to: string;
  reference: string;
  serviceType: string;
  fullName: string;
  organization: string;
  workEmail: string;
  summary: string;
  backOfficeUrl: string;
}

export interface BookingRequestAcknowledgmentInput extends RelatableInput {
  to: string;
  fullName: string;
  reference: string;
  responseDays: number;
}

export interface BookingRequestAssignedInput extends RelatableInput {
  to: string;
  reference: string;
  fullName: string;
  organization: string;
  backOfficeUrl: string;
}

export interface BookingRequestReminderInput extends RelatableInput {
  to: string;
  reference: string;
  message: string;
  backOfficeUrl: string;
}

export interface RosterApplicationTeamNotificationInput extends RelatableInput {
  to: string;
  reference: string;
  fullName: string;
  organization: string | null;
  workEmail: string;
  expertiseArea: string | null;
  backOfficeUrl: string;
}

export interface RosterApplicationAcknowledgmentInput extends RelatableInput {
  to: string;
  fullName: string;
  reference: string;
}

export interface RosterApplicationInfoRequestedInput extends RelatableInput {
  to: string;
  fullName: string;
  message: string;
}

export interface RosterApplicationRejectedInput extends RelatableInput {
  to: string;
  fullName: string;
}

export interface RosterApplicationInvitationInput extends RelatableInput {
  to: string;
  fullName: string;
  invitationUrl: string;
}

export interface SpeakerRevisionTeamNotificationInput extends RelatableInput {
  to: string;
  speakerName: string;
  backOfficeUrl: string;
}

export interface SpeakerRevisionApprovedInput extends RelatableInput {
  to: string;
  speakerName: string;
}

export interface SpeakerRevisionChangesRequestedInput extends RelatableInput {
  to: string;
  speakerName: string;
  reviewerComment: string;
}

export interface SpeakerRevisionRejectedInput extends RelatableInput {
  to: string;
  speakerName: string;
  reviewerComment: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly compiledTemplates = new Map<
    TemplateName,
    HandlebarsTemplateDelegate
  >();

  constructor(
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
  ) {}

  async sendEmailVerification(
    to: string,
    firstName: string | null,
    verificationUrl: string,
    relatedEntityId?: number,
  ): Promise<void> {
    const html = this.render('email-verification', {
      firstName: firstName ?? '',
      verificationUrl,
    });
    const subject = 'Vérifiez votre adresse email — Africa Speakers Bureau';
    await this.sendAndLog({
      template: 'email-verification',
      to,
      subject,
      html,
      relatedEntityType: 'User',
      relatedEntityId,
    });
    this.logger.log(`Email de vérification envoyé à ${to}`);
  }

  async sendPasswordReset(
    to: string,
    firstName: string | null,
    resetUrl: string,
    relatedEntityId?: number,
  ): Promise<void> {
    const html = this.render('password-reset', {
      firstName: firstName ?? '',
      resetUrl,
    });
    const subject =
      'Réinitialisation de votre mot de passe — Africa Speakers Bureau';
    await this.sendAndLog({
      template: 'password-reset',
      to,
      subject,
      html,
      relatedEntityType: 'User',
      relatedEntityId,
    });
    this.logger.log(`Email de réinitialisation envoyé à ${to}`);
  }

  async sendBookingRequestTeamNotification(
    input: BookingRequestTeamNotificationInput,
  ): Promise<void> {
    const html = this.render('booking-request-team-notification', {
      reference: input.reference,
      serviceType: input.serviceType,
      fullName: input.fullName,
      organization: input.organization,
      workEmail: input.workEmail,
      summary: input.summary,
      backOfficeUrl: input.backOfficeUrl,
    });
    const subject = `Nouvelle demande [${input.reference}] — Africa Speakers Bureau`;
    await this.sendAndLog({
      template: 'booking-request-team-notification',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'BookingRequest',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Notification interne envoyée pour ${input.reference}`);
  }

  async sendBookingRequestAcknowledgment(
    input: BookingRequestAcknowledgmentInput,
  ): Promise<void> {
    const html = this.render('booking-request-acknowledgment', {
      fullName: input.fullName,
      reference: input.reference,
      responseDays: input.responseDays,
      plural: input.responseDays > 1,
    });
    const subject = `Nous avons bien reçu votre demande [${input.reference}] — Africa Speakers Bureau`;
    await this.sendAndLog({
      template: 'booking-request-acknowledgment',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'BookingRequest',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Accusé de réception envoyé pour ${input.reference}`);
  }

  // §5 — seule notification "gestion interne" à implémenter en Phase 3b :
  // un email à l'admin lorsqu'une demande lui est assignée.
  async sendBookingRequestAssigned(
    input: BookingRequestAssignedInput,
  ): Promise<void> {
    const html = this.render('booking-request-assigned', {
      reference: input.reference,
      fullName: input.fullName,
      organization: input.organization,
      backOfficeUrl: input.backOfficeUrl,
    });
    const subject = `Demande [${input.reference}] assignée — Africa Speakers Bureau`;
    await this.sendAndLog({
      template: 'booking-request-assigned',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'BookingRequest',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Email d'assignation envoyé pour ${input.reference}`);
  }

  // §2.6 — envoyé par RemindersScheduler (tâche planifiée horaire) pour
  // chaque rappel échu.
  async sendBookingRequestReminder(
    input: BookingRequestReminderInput,
  ): Promise<void> {
    const html = this.render('booking-request-reminder', {
      reference: input.reference,
      message: input.message,
      backOfficeUrl: input.backOfficeUrl,
    });
    const subject = `Rappel — demande [${input.reference}] — Africa Speakers Bureau`;
    await this.sendAndLog({
      template: 'booking-request-reminder',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'BookingRequest',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Email de rappel envoyé pour ${input.reference}`);
  }

  async sendRosterApplicationTeamNotification(
    input: RosterApplicationTeamNotificationInput,
  ): Promise<void> {
    const html = this.render('roster-application-team-notification', {
      reference: input.reference,
      fullName: input.fullName,
      organization: input.organization ?? '',
      workEmail: input.workEmail,
      expertiseArea: input.expertiseArea ?? '',
      backOfficeUrl: input.backOfficeUrl,
    });
    const subject = `Nouvelle candidature [${input.reference}] — Africa Speakers Bureau`;
    await this.sendAndLog({
      template: 'roster-application-team-notification',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'RosterApplication',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Notification interne envoyée pour ${input.reference}`);
  }

  async sendRosterApplicationAcknowledgment(
    input: RosterApplicationAcknowledgmentInput,
  ): Promise<void> {
    const html = this.render('roster-application-acknowledgment', {
      fullName: input.fullName,
      reference: input.reference,
    });
    const subject = `Merci pour votre candidature [${input.reference}] — Africa Speakers Bureau`;
    await this.sendAndLog({
      template: 'roster-application-acknowledgment',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'RosterApplication',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Accusé de réception envoyé pour ${input.reference}`);
  }

  // §3 (Phase 3c) — passage en INFO_REQUESTED : le message libre saisi par
  // l'admin est repris tel quel dans le corps de l'email.
  async sendRosterApplicationInfoRequested(
    input: RosterApplicationInfoRequestedInput,
  ): Promise<void> {
    const html = this.render('roster-application-info-requested', {
      fullName: input.fullName,
      message: input.message,
    });
    const subject =
      'Complément demandé pour votre candidature — Africa Speakers Bureau';
    await this.sendAndLog({
      template: 'roster-application-info-requested',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'RosterApplication',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Email de demande d'informations envoyé à ${input.to}`);
  }

  // §3 (Phase 3c) — envoyé UNIQUEMENT si sendRejectionEmail est explicitement
  // coché (voir RejectRosterApplicationDto) : jamais automatique.
  async sendRosterApplicationRejected(
    input: RosterApplicationRejectedInput,
  ): Promise<void> {
    const html = this.render('roster-application-rejected', {
      fullName: input.fullName,
    });
    const subject = 'À propos de votre candidature — Africa Speakers Bureau';
    await this.sendAndLog({
      template: 'roster-application-rejected',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'RosterApplication',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Email de refus envoyé à ${input.to}`);
  }

  // §4.4 (Phase 3c) — envoyé DANS la transaction de conversion
  // (RosterApplicationsService#convert) : un échec ici annule TOUTE la
  // conversion (aucun compte orphelin), contrairement au reste des emails
  // de ce service qui sont volontairement best-effort. La ligne
  // email_deliveries, elle, est écrite via `this.prisma` (PAS le `tx` de
  // l'appelant — sendAndLog n'a pas accès à un client de transaction
  // externe) : DÉLIBÉRÉMENT indépendante de la transaction englobante, pour
  // que la trace "cet envoi a échoué" survive même si la conversion est
  // annulée juste après — un journal d'audit qui disparaîtrait avec
  // l'opération qu'il a fait échouer serait inutile.
  async sendRosterApplicationInvitation(
    input: RosterApplicationInvitationInput,
  ): Promise<void> {
    const html = this.render('roster-application-invitation', {
      fullName: input.fullName,
      invitationUrl: input.invitationUrl,
    });
    const subject = 'Votre candidature a été retenue — Africa Speakers Bureau';
    await this.sendAndLog({
      template: 'roster-application-invitation',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'RosterApplication',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Email d'invitation envoyé à ${input.to}`);
  }

  async sendSpeakerRevisionTeamNotification(
    input: SpeakerRevisionTeamNotificationInput,
  ): Promise<void> {
    const html = this.render('speaker-revision-team-notification', {
      speakerName: input.speakerName,
      backOfficeUrl: input.backOfficeUrl,
    });
    const subject = `Révision de profil soumise — ${input.speakerName} — Africa Speakers Bureau`;
    await this.sendAndLog({
      template: 'speaker-revision-team-notification',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'SpeakerRevision',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(
      `Notification interne envoyée pour la révision de ${input.speakerName}`,
    );
  }

  async sendSpeakerRevisionApproved(
    input: SpeakerRevisionApprovedInput,
  ): Promise<void> {
    const html = this.render('speaker-revision-approved', {
      speakerName: input.speakerName,
    });
    const subject =
      'Vos modifications ont été approuvées — Africa Speakers Bureau';
    await this.sendAndLog({
      template: 'speaker-revision-approved',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'SpeakerRevision',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Email d'approbation envoyé à ${input.to}`);
  }

  async sendSpeakerRevisionChangesRequested(
    input: SpeakerRevisionChangesRequestedInput,
  ): Promise<void> {
    const html = this.render('speaker-revision-changes-requested', {
      speakerName: input.speakerName,
      reviewerComment: input.reviewerComment,
    });
    const subject =
      'Corrections demandées sur votre profil — Africa Speakers Bureau';
    await this.sendAndLog({
      template: 'speaker-revision-changes-requested',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'SpeakerRevision',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Email de demande de correction envoyé à ${input.to}`);
  }

  async sendSpeakerRevisionRejected(
    input: SpeakerRevisionRejectedInput,
  ): Promise<void> {
    const html = this.render('speaker-revision-rejected', {
      speakerName: input.speakerName,
      reviewerComment: input.reviewerComment,
    });
    const subject =
      'À propos de vos modifications de profil — Africa Speakers Bureau';
    await this.sendAndLog({
      template: 'speaker-revision-rejected',
      to: input.to,
      subject,
      html,
      relatedEntityType: 'SpeakerRevision',
      relatedEntityId: input.relatedEntityId,
    });
    this.logger.log(`Email de refus envoyé à ${input.to}`);
  }

  // Consolidation, Partie E — POINT UNIQUE par lequel TOUT envoi de ce
  // service transite : écrit une ligne email_deliveries (PENDING avant la
  // tentative, SENT/FAILED après), puis se comporte exactement comme avant
  // pour l'appelant — il propage l'erreur si l'envoi échoue, ne l'avale
  // jamais ici (chaque appelant garde son propre try/catch existant,
  // capturant déjà ces échecs sans jamais faire tomber l'opération
  // métier). Le journal est un OBSERVATEUR, jamais un participant : une
  // panne de son écriture (DB indisponible pendant l'audit) ne doit
  // JAMAIS empêcher la tentative d'envoi elle-même — capturée et loguée en
  // interne, sans re-throw.
  private async sendAndLog(params: {
    template: TemplateName;
    to: string;
    subject: string;
    html: string;
    relatedEntityType?: string;
    relatedEntityId?: number;
  }): Promise<void> {
    let deliveryId: number | undefined;
    try {
      const delivery = await this.prisma.emailDelivery.create({
        data: {
          template: params.template,
          recipient: params.to,
          subject: params.subject,
          status: EmailDeliveryStatus.PENDING,
          relatedEntityType: params.relatedEntityType,
          relatedEntityId: params.relatedEntityId,
        },
      });
      deliveryId = delivery.id;
    } catch (logError) {
      this.logger.error(
        "Échec de la création du journal d'envoi (ignoré, l'envoi se poursuit quand même)",
        logError instanceof Error ? logError.stack : logError,
      );
    }

    try {
      await this.mailer.sendMail({
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      if (deliveryId !== undefined) {
        await this.markDelivery(deliveryId, {
          status: EmailDeliveryStatus.SENT,
          sentAt: new Date(),
        });
      }
    } catch (error) {
      if (deliveryId !== undefined) {
        const message = error instanceof Error ? error.message : String(error);
        await this.markDelivery(deliveryId, {
          status: EmailDeliveryStatus.FAILED,
          // Bornée : une erreur SMTP peut embarquer une réponse serveur
          // verbeuse, pas de raison de la stocker en entier.
          errorMessage: message.slice(0, 2000),
        });
      }
      throw error; // comportement inchangé pour l'appelant (cf. commentaire ci-dessus)
    }
  }

  private async markDelivery(
    id: number,
    data: { status: EmailDeliveryStatus; sentAt?: Date; errorMessage?: string },
  ): Promise<void> {
    try {
      await this.prisma.emailDelivery.update({ where: { id }, data });
    } catch (updateError) {
      this.logger.error(
        "Échec de la mise à jour du journal d'envoi (ignoré)",
        updateError instanceof Error ? updateError.stack : updateError,
      );
    }
  }

  private render(
    name: TemplateName,
    context: Record<string, string | number | boolean>,
  ): string {
    let compiled = this.compiledTemplates.get(name);

    if (!compiled) {
      const source = readFileSync(
        join(__dirname, 'templates', `${name}.hbs`),
        'utf-8',
      );
      compiled = Handlebars.compile(source, { strict: true });
      this.compiledTemplates.set(name, compiled);
    }

    return compiled(context);
  }
}
