import { Prisma } from '@prisma/client';

// Projection LÉGÈRE, utilisée pour la liste, les mutations (status/assign/
// link/update) et tout endroit qui n'a pas besoin des notes/pièces jointes.
export const BOOKING_REQUEST_INCLUDE = {
  requestedSpeaker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      publicName: true,
      slug: true,
    },
  },
  assignedAdmin: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  // Rattachement CRM (Phase 3, §3a) — voir CLAUDE.md : distinct des champs
  // d'intake ci-dessus (fullName/workEmail/organization), jamais fusionné.
  linkedContact: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  linkedOrganization: { select: { id: true, name: true } },
} satisfies Prisma.BookingRequestInclude;

export type BookingRequestRow = Prisma.BookingRequestGetPayload<{
  include: typeof BOOKING_REQUEST_INCLUDE;
}>;

const ADMIN_REF_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

// Projection COMPLÈTE, réservée à GET /admin/booking-requests/:id (§4) :
// ajoute notes/pièces jointes actives (soft delete filtré), triées.
// Les "demandes soeurs" du même contact/organisation (§6.2) ne sont PAS des
// relations directes de cette ligne — elles sont chargées séparément par le
// service (findMany contactId=X/organizationId=X, id != courant).
export const BOOKING_REQUEST_DETAIL_INCLUDE = {
  ...BOOKING_REQUEST_INCLUDE,
  notes: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: ADMIN_REF_SELECT } },
  },
  attachments: {
    where: { deletedAt: null },
    orderBy: { uploadedAt: 'desc' },
    include: { uploadedBy: { select: ADMIN_REF_SELECT } },
  },
} satisfies Prisma.BookingRequestInclude;

export type BookingRequestDetailRow = Prisma.BookingRequestGetPayload<{
  include: typeof BOOKING_REQUEST_DETAIL_INCLUDE;
}>;
