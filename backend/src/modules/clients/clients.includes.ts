import { Prisma } from '@prisma/client';

const COUNTRY_REF_SELECT = {
  id: true,
  name: true,
  iso2: true,
} satisfies Prisma.CountrySelect;
const ADMIN_REF_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;
// Projection légère de l'historique des demandes rattachées (pas le DTO
// admin complet — juste de quoi afficher une liste dans la fiche client).
const BOOKING_REQUEST_REF_SELECT = {
  id: true,
  reference: true,
  serviceType: true,
  status: true,
  createdAt: true,
} satisfies Prisma.BookingRequestSelect;

// Historique des missions rattachées (fiche organisation, §2 du prompt
// Clients) — gap comblé, approuvé avant modification (voir reference.dto.ts).
const MISSION_REF_SELECT = {
  id: true,
  reference: true,
  status: true,
  eventDate: true,
  // Pas de colonne displayName sur Speaker : composé dans le mapper à
  // partir de publicName/firstName/lastName, même pattern que
  // RequestedSpeakerRefDto (modules/booking-requests).
  speaker: {
    select: { id: true, publicName: true, firstName: true, lastName: true },
  },
} satisfies Prisma.MissionSelect;

// Compteurs + dernière activité pour la LISTE des organisations (§1 du
// prompt Clients) : "nombre de demandes"/"nombre de missions" via _count,
// "dernière activité" calculée dans le mapper à partir de la plus récente
// des trois dates disponibles (demande, mission, mise à jour de la fiche
// elle-même) — jamais stockée, même principe que isOverdue/checklistProgress.
export const ORGANIZATION_LIST_INCLUDE = {
  country: { select: COUNTRY_REF_SELECT },
  assignedAdmin: { select: ADMIN_REF_SELECT },
  _count: { select: { bookingRequests: true, missions: true } },
  bookingRequests: {
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  missions: {
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.OrganizationInclude;

export type OrganizationListRow = Prisma.OrganizationGetPayload<{
  include: typeof ORGANIZATION_LIST_INCLUDE;
}>;

export const ORGANIZATION_DETAIL_INCLUDE = {
  country: { select: COUNTRY_REF_SELECT },
  assignedAdmin: { select: ADMIN_REF_SELECT },
  contacts: {
    where: { deletedAt: null },
    orderBy: { lastName: 'asc' },
  },
  bookingRequests: {
    select: BOOKING_REQUEST_REF_SELECT,
    orderBy: { createdAt: 'desc' },
  },
  missions: {
    select: MISSION_REF_SELECT,
    orderBy: { eventDate: 'desc' },
  },
} satisfies Prisma.OrganizationInclude;

export type OrganizationDetailRow = Prisma.OrganizationGetPayload<{
  include: typeof ORGANIZATION_DETAIL_INCLUDE;
}>;

export const CONTACT_LIST_INCLUDE = {
  organization: { select: { id: true, name: true } },
  country: { select: COUNTRY_REF_SELECT },
} satisfies Prisma.ContactInclude;

export type ContactListRow = Prisma.ContactGetPayload<{
  include: typeof CONTACT_LIST_INCLUDE;
}>;

export const CONTACT_DETAIL_INCLUDE = {
  organization: { select: { id: true, name: true } },
  country: { select: COUNTRY_REF_SELECT },
  bookingRequests: {
    select: BOOKING_REQUEST_REF_SELECT,
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.ContactInclude;

export type ContactDetailRow = Prisma.ContactGetPayload<{
  include: typeof CONTACT_DETAIL_INCLUDE;
}>;
