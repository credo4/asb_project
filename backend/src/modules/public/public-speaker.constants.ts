import { Prisma, SpeakerStatus } from '@prisma/client';

// ⚠️ INVARIANT CRITIQUE (voir CLAUDE.md §5) — condition UNIQUE et
// centralisée pour déterminer qu'un speaker est visible publiquement.
// Toute requête Prisma de ce module doit spreader cette fonction dans son
// `where` — jamais réécrire ces trois conditions à la main ailleurs, pour
// qu'il soit impossible de les oublier sur une nouvelle route.
export function publicSpeakerWhere(): Prisma.SpeakerWhereInput {
  return {
    status: SpeakerStatus.PUBLISHED,
    isVisible: true,
    deletedAt: null,
  };
}

export const PUBLIC_MAX_PER_PAGE = 50;
export const PUBLIC_DEFAULT_PER_PAGE = 20;
export const TOP_REQUESTED_LIMIT = 12;
export const PUBLIC_PILLARS_PER_SPEAKER = 3;
