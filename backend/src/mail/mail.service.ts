import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import * as Handlebars from 'handlebars';

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

export interface BookingRequestTeamNotificationInput {
  to: string;
  reference: string;
  serviceType: string;
  fullName: string;
  organization: string;
  workEmail: string;
  summary: string;
  backOfficeUrl: string;
}

export interface BookingRequestAcknowledgmentInput {
  to: string;
  fullName: string;
  reference: string;
  responseDays: number;
}

export interface BookingRequestAssignedInput {
  to: string;
  reference: string;
  fullName: string;
  organization: string;
  backOfficeUrl: string;
}

export interface BookingRequestReminderInput {
  to: string;
  reference: string;
  message: string;
  backOfficeUrl: string;
}

export interface RosterApplicationTeamNotificationInput {
  to: string;
  reference: string;
  fullName: string;
  organization: string | null;
  workEmail: string;
  expertiseArea: string | null;
  backOfficeUrl: string;
}

export interface RosterApplicationAcknowledgmentInput {
  to: string;
  fullName: string;
  reference: string;
}

export interface RosterApplicationInfoRequestedInput {
  to: string;
  fullName: string;
  message: string;
}

export interface RosterApplicationRejectedInput {
  to: string;
  fullName: string;
}

export interface RosterApplicationInvitationInput {
  to: string;
  fullName: string;
  invitationUrl: string;
}

export interface SpeakerRevisionTeamNotificationInput {
  to: string;
  speakerName: string;
  backOfficeUrl: string;
}

export interface SpeakerRevisionApprovedInput {
  to: string;
  speakerName: string;
}

export interface SpeakerRevisionChangesRequestedInput {
  to: string;
  speakerName: string;
  reviewerComment: string;
}

export interface SpeakerRevisionRejectedInput {
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

  constructor(private readonly mailer: MailerService) {}

  async sendEmailVerification(
    to: string,
    firstName: string | null,
    verificationUrl: string,
  ): Promise<void> {
    const html = this.render('email-verification', {
      firstName: firstName ?? '',
      verificationUrl,
    });
    await this.mailer.sendMail({
      to,
      subject: 'Vérifiez votre adresse email — Africa Speakers Bureau',
      html,
    });
    this.logger.log(`Email de vérification envoyé à ${to}`);
  }

  async sendPasswordReset(
    to: string,
    firstName: string | null,
    resetUrl: string,
  ): Promise<void> {
    const html = this.render('password-reset', {
      firstName: firstName ?? '',
      resetUrl,
    });
    await this.mailer.sendMail({
      to,
      subject:
        'Réinitialisation de votre mot de passe — Africa Speakers Bureau',
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject: `Nouvelle demande [${input.reference}] — Africa Speakers Bureau`,
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject: `Nous avons bien reçu votre demande [${input.reference}] — Africa Speakers Bureau`,
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject: `Demande [${input.reference}] assignée — Africa Speakers Bureau`,
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject: `Rappel — demande [${input.reference}] — Africa Speakers Bureau`,
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject: `Nouvelle candidature [${input.reference}] — Africa Speakers Bureau`,
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject: `Merci pour votre candidature [${input.reference}] — Africa Speakers Bureau`,
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject:
        'Complément demandé pour votre candidature — Africa Speakers Bureau',
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject: 'À propos de votre candidature — Africa Speakers Bureau',
      html,
    });
    this.logger.log(`Email de refus envoyé à ${input.to}`);
  }

  // §4.4 (Phase 3c) — envoyé DANS la transaction de conversion
  // (RosterApplicationsService#convert) : un échec ici annule TOUTE la
  // conversion (aucun compte orphelin), contrairement au reste des emails
  // de ce service qui sont volontairement best-effort.
  async sendRosterApplicationInvitation(
    input: RosterApplicationInvitationInput,
  ): Promise<void> {
    const html = this.render('roster-application-invitation', {
      fullName: input.fullName,
      invitationUrl: input.invitationUrl,
    });
    await this.mailer.sendMail({
      to: input.to,
      subject: 'Votre candidature a été retenue — Africa Speakers Bureau',
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject: `Révision de profil soumise — ${input.speakerName} — Africa Speakers Bureau`,
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject: 'Vos modifications ont été approuvées — Africa Speakers Bureau',
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject:
        'Corrections demandées sur votre profil — Africa Speakers Bureau',
      html,
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
    await this.mailer.sendMail({
      to: input.to,
      subject:
        'À propos de vos modifications de profil — Africa Speakers Bureau',
      html,
    });
    this.logger.log(`Email de refus envoyé à ${input.to}`);
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
