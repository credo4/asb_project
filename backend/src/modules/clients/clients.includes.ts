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

export const ORGANIZATION_LIST_INCLUDE = {
  country: { select: COUNTRY_REF_SELECT },
  assignedAdmin: { select: ADMIN_REF_SELECT },
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
