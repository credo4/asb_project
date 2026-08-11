import { Prisma } from '@prisma/client';

export const SPEAKER_REVISION_INCLUDE = {
  speaker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      publicName: true,
      slug: true,
    },
  },
  reviewedBy: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} satisfies Prisma.SpeakerRevisionInclude;

export type SpeakerRevisionRow = Prisma.SpeakerRevisionGetPayload<{
  include: typeof SPEAKER_REVISION_INCLUDE;
}>;
