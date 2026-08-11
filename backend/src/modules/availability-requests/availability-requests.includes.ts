import { Prisma } from '@prisma/client';

// SELECT partagé par les projections admin ET speaker (voir mapper) — les
// DEUX DTO de sortie piochent dans les MÊMES colonnes chargées ici, seule
// la projection JS diffère (allow-list stricte côté speaker, voir
// AvailabilityRequestBriefingDto). Aucune requête séparée par vue.
export const AVAILABILITY_REQUEST_SELECT = {
  id: true,
  bookingRequestId: true,
  speakerId: true,
  sentBy: { select: { email: true } },
  sentAt: true,
  respondDueAt: true,
  status: true,
  eventType: true,
  eventDate: true,
  eventEndDate: true,
  locationCountry: { select: { name: true } },
  isVirtual: true,
  durationMinutes: true,
  topic: true,
  audienceDescription: true,
  audienceSize: true,
  language: true,
  proposedFeeAmount: true,
  proposedFeeCurrency: true,
  travelConditions: true,
  additionalNotes: true,
  responseStatus: true,
  respondedAt: true,
  speakerPrivateComment: true,
} satisfies Prisma.AvailabilityRequestSelect;

export type AvailabilityRequestRow = Prisma.AvailabilityRequestGetPayload<{
  select: typeof AVAILABILITY_REQUEST_SELECT;
}>;
