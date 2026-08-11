import {
  BookingRequestDetailRow,
  BookingRequestRow,
} from '../booking-requests.includes';
import { BookingRequestListItemDto } from '../dto/booking-request-list-item.dto';
import { BookingRequestDetailDto } from '../dto/booking-request-detail.dto';
import { BookingRequestNoteDto } from '../dto/outputs/booking-request-note.dto';
import { BookingRequestAttachmentDto } from '../dto/outputs/booking-request-attachment.dto';
import {
  AdminRefDto,
  LinkedContactRefDto,
  LinkedOrganizationRefDto,
  RequestedSpeakerRefDto,
  SiblingBookingRequestRefDto,
} from '../dto/outputs/reference.dto';

function toAdminRef(
  admin: BookingRequestRow['assignedAdmin'],
): AdminRefDto | null {
  if (!admin) return null;
  return {
    id: admin.id,
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
  };
}

function toRequestedSpeakerRef(
  speaker: BookingRequestRow['requestedSpeaker'],
): RequestedSpeakerRefDto | null {
  if (!speaker) return null;
  return {
    id: speaker.id,
    displayName:
      speaker.publicName ?? `${speaker.firstName} ${speaker.lastName}`,
    slug: speaker.slug,
  };
}

function toLinkedContactRef(
  contact: BookingRequestRow['linkedContact'],
): LinkedContactRefDto | null {
  if (!contact) return null;
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
  };
}

function toLinkedOrganizationRef(
  organization: BookingRequestRow['linkedOrganization'],
): LinkedOrganizationRefDto | null {
  if (!organization) return null;
  return { id: organization.id, name: organization.name };
}

// §2.5 — CALCULÉ, jamais stocké : un dépassement de responseDueAt ne
// "devient vrai" pas à un instant précis en base, il se recalcule à chaque
// lecture par rapport à `Date.now()`. Dès que `firstRespondedAt` est
// renseigné, la demande n'est plus "sans réponse" quel que soit
// responseDueAt.
export function computeIsOverdue(row: {
  responseDueAt: Date | null;
  firstRespondedAt: Date | null;
}): boolean {
  if (row.firstRespondedAt !== null) return false;
  if (row.responseDueAt === null) return false;
  return row.responseDueAt.getTime() < Date.now();
}

export function toListItemDto(
  row: BookingRequestRow,
): BookingRequestListItemDto {
  return {
    id: row.id,
    reference: row.reference,
    serviceType: row.serviceType,
    status: row.status,
    priority: row.priority,
    fullName: row.fullName,
    organization: row.organization ?? '',
    workEmail: row.workEmail,
    eventName: row.eventName,
    eventDate: row.eventDate,
    eventLocation: row.eventLocation,
    estimatedBudget: row.estimatedBudget,
    assignedAdmin: toAdminRef(row.assignedAdmin),
    responseDueAt: row.responseDueAt,
    isOverdue: computeIsOverdue(row),
    createdAt: row.createdAt,
  };
}

function toSiblingRef(row: {
  id: number;
  reference: string;
  serviceType: BookingRequestRow['serviceType'];
  status: BookingRequestRow['status'];
  createdAt: Date;
}): SiblingBookingRequestRefDto {
  return {
    id: row.id,
    reference: row.reference,
    serviceType: row.serviceType,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function toNoteDto(
  note: BookingRequestDetailRow['notes'][number],
): BookingRequestNoteDto {
  return {
    id: note.id,
    body: note.body,
    author: toAdminRef(note.author),
    createdAt: note.createdAt,
  };
}

export function toAttachmentDto(
  attachment: BookingRequestDetailRow['attachments'][number],
): BookingRequestAttachmentDto {
  return {
    id: attachment.id,
    originalFilename: attachment.originalFilename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    uploadedBy: toAdminRef(attachment.uploadedBy),
    uploadedAt: attachment.uploadedAt,
  };
}

export function toDetailDto(
  row: BookingRequestDetailRow,
  siblingRequests: {
    fromContact: {
      id: number;
      reference: string;
      serviceType: BookingRequestRow['serviceType'];
      status: BookingRequestRow['status'];
      createdAt: Date;
    }[];
    fromOrganization: {
      id: number;
      reference: string;
      serviceType: BookingRequestRow['serviceType'];
      status: BookingRequestRow['status'];
      createdAt: Date;
    }[];
  },
): BookingRequestDetailDto {
  return {
    id: row.id,
    reference: row.reference,
    serviceType: row.serviceType,
    status: row.status,
    priority: row.priority,

    fullName: row.fullName,
    organization: row.organization ?? '',
    jobTitle: row.jobTitle,
    workEmail: row.workEmail,
    phone: row.phone,
    websiteOrLinkedin: row.websiteOrLinkedin,

    eventName: row.eventName,
    eventDate: row.eventDate,
    eventLocation: row.eventLocation,
    eventFormat: row.eventFormat,
    audienceSize: row.audienceSize,
    sessionLength: row.sessionLength,
    language: row.language,

    primaryTopics: row.primaryTopics,
    goals: row.goals,
    speakerPreferences: row.speakerPreferences,
    estimatedBudget: row.estimatedBudget,
    additionalComments: row.additionalComments,

    visitPurpose: row.visitPurpose,
    keyQuestions: row.keyQuestions,
    preferredTime: row.preferredTime,

    metadata: row.metadata as Record<string, unknown> | null,

    requestedSpeaker: toRequestedSpeakerRef(row.requestedSpeaker),
    assignedAdmin: toAdminRef(row.assignedAdmin),
    linkedContact: toLinkedContactRef(row.linkedContact),
    linkedOrganization: toLinkedOrganizationRef(row.linkedOrganization),
    source: row.source,
    gdprConsent: row.gdprConsent,
    responseDueAt: row.responseDueAt,
    firstRespondedAt: row.firstRespondedAt,
    isOverdue: computeIsOverdue(row),

    consentGivenAt: row.consentGivenAt,
    consentVersion: row.consentVersion,

    notes: row.notes.map(toNoteDto),
    attachments: row.attachments.map(toAttachmentDto),

    siblingRequestsFromContact: siblingRequests.fromContact.map(toSiblingRef),
    siblingRequestsFromOrganization:
      siblingRequests.fromOrganization.map(toSiblingRef),

    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Résumé restreint pour le journal d'activité (mêmes principes que
// modules/speakers/speakers.service.ts#scalarSnapshot).
export function scalarSnapshot(
  row: BookingRequestRow,
): Record<string, unknown> {
  return {
    id: row.id,
    reference: row.reference,
    serviceType: row.serviceType,
    status: row.status,
    priority: row.priority,
    assignedAdminId: row.assignedAdminId,
    updatedAt: row.updatedAt,
  };
}
