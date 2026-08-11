import { Prisma } from '@prisma/client';

// Projection LÉGÈRE — liste admin (juste le nombre de membres, pas le détail).
export const CURATED_LIST_LIST_INCLUDE = {
  _count: { select: { members: true } },
} satisfies Prisma.CuratedListInclude;

export type CuratedListListRow = Prisma.CuratedListGetPayload<{
  include: typeof CURATED_LIST_LIST_INCLUDE;
}>;

const MEMBER_SPEAKER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  publicName: true,
  slug: true,
  status: true,
  isVisible: true,
} satisfies Prisma.SpeakerSelect;

// Projection COMPLÈTE — détail admin, avec CHAQUE membre et son statut/sa
// visibilité (voir CuratedListMemberDto pour pourquoi).
export const CURATED_LIST_DETAIL_INCLUDE = {
  members: {
    orderBy: { displayOrder: 'asc' },
    include: { speaker: { select: MEMBER_SPEAKER_SELECT } },
  },
} satisfies Prisma.CuratedListInclude;

export type CuratedListDetailRow = Prisma.CuratedListGetPayload<{
  include: typeof CURATED_LIST_DETAIL_INCLUDE;
}>;
