import { Prisma } from '@prisma/client';

// SELECT partagé par les projections admin ET speaker (voir mapper) — comme
// en 3d (AvailabilityRequest), les DEUX DTO de sortie piochent dans les
// MÊMES colonnes chargées ici, seule la projection JS diffère (allow-list
// stricte côté speaker, voir MissionSpeakerDto).
export const MISSION_SELECT = {
  id: true,
  reference: true,
  bookingRequestId: true,
  speakerId: true,
  organizationId: true,
  contactId: true,
  serviceType: true,
  eventDate: true,
  startTime: true,
  endTime: true,
  timezone: true,
  locationCountryId: true,
  address: true,
  isVirtual: true,
  virtualLink: true,
  onSiteContactName: true,
  onSiteContactPhone: true,
  durationMinutes: true,
  topic: true,
  language: true,
  format: true,
  participantCount: true,
  clientAmount: true,
  speakerAmount: true,
  agencyCommission: true,
  expenses: true,
  currency: true,
  status: true,
  contractStatus: true,
  paymentStatus: true,
  logisticsStatus: true,
  internalNotes: true,
  cancellationReason: true,
  acceptedAt: true,
  briefAcknowledgedAt: true,
  createdAt: true,
  speaker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      publicName: true,
      slug: true,
      profilePhotoUrl: true,
    },
  },
  bookingRequest: {
    select: { id: true, reference: true, eventName: true },
  },
  organization: { select: { id: true, name: true } },
  locationCountry: { select: { name: true } },
} satisfies Prisma.MissionSelect;

export type MissionRow = Prisma.MissionGetPayload<{
  select: typeof MISSION_SELECT;
}>;

export const MISSION_LIST_SELECT = {
  id: true,
  reference: true,
  serviceType: true,
  eventDate: true,
  status: true,
  contractStatus: true,
  paymentStatus: true,
  logisticsStatus: true,
  // Ajoutés pour les colonnes "lieu ou distanciel" / "avancement de la
  // checklist" du back-office (extension module Missions, §2) — validé
  // avec l'utilisateur avant ajout, aucune nouvelle route, juste ce SELECT
  // et le mapper de liste étendus (voir toAdminListItemDto).
  isVirtual: true,
  locationCountry: { select: { name: true } },
  checklistItems: { select: { isDone: true } },
  speaker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      publicName: true,
      slug: true,
      profilePhotoUrl: true,
    },
  },
  bookingRequest: {
    select: { id: true, reference: true, eventName: true },
  },
  organization: { select: { id: true, name: true } },
} satisfies Prisma.MissionSelect;

export type MissionListRow = Prisma.MissionGetPayload<{
  select: typeof MISSION_LIST_SELECT;
}>;
