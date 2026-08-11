import {
  BookingPriority,
  BookingRequestSource,
  BookingStatus,
  OneToOnePurpose,
  ServiceType,
} from '@prisma/client';
import {
  AdminRefDto,
  LinkedContactRefDto,
  LinkedOrganizationRefDto,
  RequestedSpeakerRefDto,
  SiblingBookingRequestRefDto,
} from './outputs/reference.dto';
import { BookingRequestNoteDto } from './outputs/booking-request-note.dto';
import { BookingRequestAttachmentDto } from './outputs/booking-request-attachment.dto';
import { EmailDeliverySummaryDto } from '../../../mail/dto/outputs/email-delivery-item.dto';

// Projection COMPLÈTE réservée à l'admin (route déjà restreinte à
// ADMIN/SUPER_ADMIN — voir BookingRequestsController).
export class BookingRequestDetailDto {
  id!: number;
  reference!: string;
  serviceType!: ServiceType;
  status!: BookingStatus;
  priority!: BookingPriority;

  fullName!: string;
  organization!: string;
  jobTitle!: string | null;
  workEmail!: string;
  phone!: string | null;
  websiteOrLinkedin!: string | null;

  eventName!: string | null;
  eventDate!: Date | null;
  eventLocation!: string | null;
  eventFormat!: string | null;
  audienceSize!: string | null;
  sessionLength!: string | null;
  language!: string | null;

  primaryTopics!: string | null;
  goals!: string | null;
  speakerPreferences!: string | null;
  estimatedBudget!: string | null;
  additionalComments!: string | null;

  visitPurpose!: OneToOnePurpose | null;
  keyQuestions!: string | null;
  preferredTime!: string | null;

  metadata!: Record<string, unknown> | null;

  requestedSpeaker!: RequestedSpeakerRefDto | null;
  assignedAdmin!: AdminRefDto | null;
  linkedContact!: LinkedContactRefDto | null;
  linkedOrganization!: LinkedOrganizationRefDto | null;
  source!: BookingRequestSource;
  gdprConsent!: boolean;
  responseDueAt!: Date | null;
  // Renseigné à la première transition hors NEW OU à la première note
  // interne (le premier des deux) — voir §2.5.
  firstRespondedAt!: Date | null;
  // Calculé (jamais stocké) : responseDueAt dépassé ET firstRespondedAt vide.
  isOverdue!: boolean;

  // Transition douce (§3) : nullable tant que REQUIRE_CONSENT vaut false.
  consentGivenAt!: Date | null;
  consentVersion!: string | null;

  notes!: BookingRequestNoteDto[];
  attachments!: BookingRequestAttachmentDto[];
  // §E (consolidation) — historique des tentatives d'envoi liées à cette
  // demande (notification interne, accusé de réception, assignation,
  // rappels), trié du plus récent au plus ancien : emailDeliveries[0] EST
  // "le statut du dernier envoi". Permet à l'équipe de voir directement
  // "accusé de réception non envoyé" sans creuser les logs serveur.
  emailDeliveries!: EmailDeliverySummaryDto[];

  // §6.2 — historique des autres demandes du même contact/de la même
  // organisation (exclut la demande courante).
  siblingRequestsFromContact!: SiblingBookingRequestRefDto[];
  siblingRequestsFromOrganization!: SiblingBookingRequestRefDto[];

  createdAt!: Date;
  updatedAt!: Date;
}
