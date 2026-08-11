import { Prisma } from '@prisma/client';
import { EVALUATION_CRITERIA_KEYS } from './aggregated-score.util';

const ADMIN_REF_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

// Juste les 9 critères (pas l'évaluateur, pas le commentaire) : suffisant
// pour calculer le score agrégé côté liste/détail (voir aggregated-score.util.ts),
// sans alourdir la requête avec des relations inutiles à ce stade.
const EVALUATION_CRITERIA_SELECT = Object.fromEntries(
  EVALUATION_CRITERIA_KEYS.map((key) => [key, true]),
) as Record<(typeof EVALUATION_CRITERIA_KEYS)[number], true>;

// Projection LÉGÈRE — mutations (status/assign/reject/convert/...), pas
// besoin des évaluations ni des pièces jointes.
export const ROSTER_APPLICATION_INCLUDE = {
  assignedAdmin: { select: ADMIN_REF_SELECT },
  convertedSpeaker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      publicName: true,
      slug: true,
    },
  },
  convertedUser: { select: { id: true, email: true, status: true } },
} satisfies Prisma.RosterApplicationInclude;

export type RosterApplicationRow = Prisma.RosterApplicationGetPayload<{
  include: typeof ROSTER_APPLICATION_INCLUDE;
}>;

// Projection LISTE — ajoute les critères d'évaluation (score agrégé calculé
// côté mapper), pas l'identité des évaluateurs (inutile en colonne de liste).
export const ROSTER_APPLICATION_LIST_INCLUDE = {
  ...ROSTER_APPLICATION_INCLUDE,
  evaluations: { select: EVALUATION_CRITERIA_SELECT },
} satisfies Prisma.RosterApplicationInclude;

export type RosterApplicationListRow = Prisma.RosterApplicationGetPayload<{
  include: typeof ROSTER_APPLICATION_LIST_INCLUDE;
}>;

// Projection COMPLÈTE — GET /admin/roster-applications/:id (§5.2) : ajoute
// évaluations (avec l'évaluateur) et pièces jointes actives (soft delete
// filtré), triées.
export const ROSTER_APPLICATION_DETAIL_INCLUDE = {
  ...ROSTER_APPLICATION_INCLUDE,
  evaluations: {
    orderBy: { createdAt: 'asc' },
    include: { evaluator: { select: ADMIN_REF_SELECT } },
  },
  attachments: {
    where: { deletedAt: null },
    orderBy: { uploadedAt: 'desc' },
    include: { uploadedBy: { select: ADMIN_REF_SELECT } },
  },
} satisfies Prisma.RosterApplicationInclude;

export type RosterApplicationDetailRow = Prisma.RosterApplicationGetPayload<{
  include: typeof ROSTER_APPLICATION_DETAIL_INCLUDE;
}>;
