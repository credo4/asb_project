import { Prisma } from '@prisma/client';

export const DOCUMENT_ADMIN_INCLUDE = {
  speaker: {
    select: { id: true, firstName: true, lastName: true, publicName: true },
  },
} satisfies Prisma.SpeakerDocumentInclude;

export type DocumentAdminRow = Prisma.SpeakerDocumentGetPayload<{
  include: typeof DOCUMENT_ADMIN_INCLUDE;
}>;
