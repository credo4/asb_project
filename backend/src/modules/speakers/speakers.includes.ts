import { Prisma } from '@prisma/client';

// Projection légère utilisée par GET /admin/speakers (liste). Le pilier
// principal est filtré côté requête (where isPrimary) plutôt qu'en mémoire.
export const SPEAKER_LIST_INCLUDE = {
  country: { select: { id: true, name: true, iso2: true } },
  pillars: {
    where: { isPrimary: true },
    take: 1,
    include: { pillar: { select: { id: true, name: true, slug: true } } },
  },
  languages: {
    include: { language: { select: { id: true, name: true, code: true } } },
  },
} satisfies Prisma.SpeakerInclude;

export type SpeakerListRow = Prisma.SpeakerGetPayload<{
  include: typeof SPEAKER_LIST_INCLUDE;
}>;

// Projection complète utilisée par GET/POST/PATCH /admin/speakers/:id.
export const SPEAKER_DETAIL_INCLUDE = {
  country: true,
  nationality: true,
  pillars: {
    include: { pillar: true },
    orderBy: { displayOrder: 'asc' },
  },
  themes: { include: { theme: true } },
  keywords: true,
  formats: { include: { format: true } },
  languages: { include: { language: true } },
  pricing: true,
  engagements: {
    include: { country: { select: { id: true, name: true, iso2: true } } },
    orderBy: { displayOrder: 'asc' },
  },
  // deletedAt: null — un média soft-supprimé ne doit apparaître ni côté
  // admin ni (a fortiori) dans l'aperçu de révision qui réutilise cette
  // même fiche (voir SpeakerRevisionPreviewService).
  media: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
} satisfies Prisma.SpeakerInclude;

export type SpeakerDetailRow = Prisma.SpeakerGetPayload<{
  include: typeof SPEAKER_DETAIL_INCLUDE;
}>;
