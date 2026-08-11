import { Prisma } from '@prisma/client';

export const MEDIA_INCLUDE = {
  reviewedBy: { select: { id: true, email: true } },
} satisfies Prisma.SpeakerMediaInclude;

export type MediaRow = Prisma.SpeakerMediaGetPayload<{
  include: typeof MEDIA_INCLUDE;
}>;

export const MEDIA_ADMIN_INCLUDE = {
  reviewedBy: { select: { id: true, email: true } },
  speaker: {
    select: { id: true, firstName: true, lastName: true, publicName: true },
  },
} satisfies Prisma.SpeakerMediaInclude;

export type MediaAdminRow = Prisma.SpeakerMediaGetPayload<{
  include: typeof MEDIA_ADMIN_INCLUDE;
}>;
