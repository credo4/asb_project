import { MissionRow, MissionListRow } from '../missions.includes';
import { MissionSpeakerDto } from '../dto/outputs/mission-speaker.dto';
import {
  MissionAdminDetailDto,
  MissionAdminListItemDto,
} from '../dto/outputs/mission-admin.dto';
import { MissionChecklistItemDto } from '../dto/outputs/mission-checklist-item.dto';
import { MissionDocumentDto } from '../dto/outputs/mission-document.dto';
import { MissionMessageDto } from '../dto/outputs/mission-message.dto';

function speakerRefDisplayName(speaker: MissionRow['speaker']): string {
  return speaker.publicName ?? `${speaker.firstName} ${speaker.lastName}`;
}

// §5 — voir l'en-tête de MissionSpeakerDto pour la liste exacte des champs
// délibérément absents. AUCUN spread de `row` ici, même partiel : chaque
// champ exposé est listé explicitement.
export function toSpeakerDto(row: MissionRow): MissionSpeakerDto {
  return {
    id: row.id,
    reference: row.reference,
    organizationName: row.organization?.name ?? null,
    serviceType: row.serviceType,
    eventDate: row.eventDate.toISOString(),
    startTime: row.startTime,
    endTime: row.endTime,
    timezone: row.timezone,
    locationCountryName: row.locationCountry?.name ?? null,
    address: row.address,
    isVirtual: row.isVirtual,
    virtualLink: row.virtualLink,
    onSiteContactName: row.onSiteContactName,
    onSiteContactPhone: row.onSiteContactPhone,
    durationMinutes: row.durationMinutes,
    topic: row.topic,
    language: row.language,
    format: row.format,
    participantCount: row.participantCount,
    speakerAmount: row.speakerAmount?.toString() ?? null,
    expenses: row.expenses?.toString() ?? null,
    currency: row.currency,
    status: row.status,
    logisticsStatus: row.logisticsStatus,
    cancellationReason: row.cancellationReason,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    briefAcknowledgedAt: row.briefAcknowledgedAt?.toISOString() ?? null,
  };
}

export function toAdminListItemDto(
  row: MissionListRow,
): MissionAdminListItemDto {
  // Même formule que composeAdminDetail() côté service (0 si aucun point --
  // une checklist vide n'est ni "faite" ni "à faire").
  const checklistProgressPercent =
    row.checklistItems.length === 0
      ? 0
      : Math.round(
          (row.checklistItems.filter((c) => c.isDone).length /
            row.checklistItems.length) *
            100,
        );

  return {
    id: row.id,
    reference: row.reference,
    speaker: {
      id: row.speaker.id,
      displayName: speakerRefDisplayName(row.speaker),
      slug: row.speaker.slug,
      profilePhotoUrl: row.speaker.profilePhotoUrl,
    },
    bookingRequest: {
      id: row.bookingRequest.id,
      reference: row.bookingRequest.reference,
      eventName: row.bookingRequest.eventName,
    },
    organization: row.organization
      ? { id: row.organization.id, name: row.organization.name }
      : null,
    serviceType: row.serviceType,
    eventDate: row.eventDate.toISOString(),
    status: row.status,
    contractStatus: row.contractStatus,
    paymentStatus: row.paymentStatus,
    logisticsStatus: row.logisticsStatus,
    isVirtual: row.isVirtual,
    locationCountryName: row.locationCountry?.name ?? null,
    checklistProgressPercent,
  };
}

export function toAdminDetailDto(
  row: MissionRow,
  checklist: MissionChecklistItemDto[],
  checklistProgressPercent: number,
  documents: MissionDocumentDto[],
  messages: MissionMessageDto[],
): MissionAdminDetailDto {
  return {
    id: row.id,
    reference: row.reference,
    speaker: {
      id: row.speaker.id,
      displayName: speakerRefDisplayName(row.speaker),
      slug: row.speaker.slug,
      profilePhotoUrl: row.speaker.profilePhotoUrl,
    },
    bookingRequest: {
      id: row.bookingRequest.id,
      reference: row.bookingRequest.reference,
      eventName: row.bookingRequest.eventName,
    },
    organization: row.organization
      ? { id: row.organization.id, name: row.organization.name }
      : null,
    serviceType: row.serviceType,
    eventDate: row.eventDate.toISOString(),
    startTime: row.startTime,
    endTime: row.endTime,
    timezone: row.timezone,
    locationCountryName: row.locationCountry?.name ?? null,
    address: row.address,
    isVirtual: row.isVirtual,
    virtualLink: row.virtualLink,
    onSiteContactName: row.onSiteContactName,
    onSiteContactPhone: row.onSiteContactPhone,
    durationMinutes: row.durationMinutes,
    topic: row.topic,
    language: row.language,
    format: row.format,
    participantCount: row.participantCount,
    clientAmount: row.clientAmount?.toString() ?? null,
    speakerAmount: row.speakerAmount?.toString() ?? null,
    agencyCommission: row.agencyCommission?.toString() ?? null,
    expenses: row.expenses?.toString() ?? null,
    currency: row.currency,
    status: row.status,
    contractStatus: row.contractStatus,
    paymentStatus: row.paymentStatus,
    logisticsStatus: row.logisticsStatus,
    internalNotes: row.internalNotes,
    cancellationReason: row.cancellationReason,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    briefAcknowledgedAt: row.briefAcknowledgedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    checklist,
    checklistProgressPercent,
    documents,
    messages,
  };
}
