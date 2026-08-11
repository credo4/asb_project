import { AvailabilityRequestRow } from '../availability-requests.includes';
import { AvailabilityRequestBriefingDto } from '../dto/outputs/availability-request-briefing.dto';
import { AvailabilityRequestAdminDto } from '../dto/outputs/availability-request-admin.dto';

// §3.1 — allow-list stricte : SEULS les champs listés explicitement ici
// atterrissent sur le DTO speaker. Ne JAMAIS spreader `row` sur ce DTO,
// même partiellement — voir le commentaire en tête de
// AvailabilityRequestBriefingDto.
export function toBriefingDto(
  row: AvailabilityRequestRow,
): AvailabilityRequestBriefingDto {
  return {
    id: row.id,
    status: row.status,
    sentAt: row.sentAt.toISOString(),
    respondDueAt: row.respondDueAt.toISOString(),
    eventType: row.eventType,
    eventDate: row.eventDate.toISOString(),
    eventEndDate: row.eventEndDate?.toISOString() ?? null,
    locationCountryName: row.locationCountry?.name ?? null,
    isVirtual: row.isVirtual,
    durationMinutes: row.durationMinutes,
    topic: row.topic,
    audienceDescription: row.audienceDescription,
    audienceSize: row.audienceSize,
    language: row.language,
    proposedFeeAmount: row.proposedFeeAmount?.toString() ?? null,
    proposedFeeCurrency: row.proposedFeeCurrency,
    travelConditions: row.travelConditions,
    additionalNotes: row.additionalNotes,
    responseStatus: row.responseStatus,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    speakerPrivateComment: row.speakerPrivateComment,
  };
}

export function toAdminDto(
  row: AvailabilityRequestRow,
): AvailabilityRequestAdminDto {
  return {
    id: row.id,
    bookingRequestId: row.bookingRequestId,
    speakerId: row.speakerId,
    sentByEmail: row.sentBy?.email ?? null,
    sentAt: row.sentAt.toISOString(),
    respondDueAt: row.respondDueAt.toISOString(),
    status: row.status,
    eventType: row.eventType,
    eventDate: row.eventDate.toISOString(),
    eventEndDate: row.eventEndDate?.toISOString() ?? null,
    locationCountryName: row.locationCountry?.name ?? null,
    isVirtual: row.isVirtual,
    durationMinutes: row.durationMinutes,
    topic: row.topic,
    audienceDescription: row.audienceDescription,
    audienceSize: row.audienceSize,
    language: row.language,
    proposedFeeAmount: row.proposedFeeAmount?.toString() ?? null,
    proposedFeeCurrency: row.proposedFeeCurrency,
    travelConditions: row.travelConditions,
    additionalNotes: row.additionalNotes,
    responseStatus: row.responseStatus,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    speakerPrivateComment: row.speakerPrivateComment,
  };
}
