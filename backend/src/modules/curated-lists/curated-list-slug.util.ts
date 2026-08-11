import { Prisma } from '@prisma/client';
import { slugify } from '../speakers/slug.util';

// Même stratégie que speakers/slug.util.ts#resolveUniqueSlug (suffixe
// numérique tant que le slug est pris) — copie scopée à `curated_lists`
// plutôt qu'une abstraction partagée entre domaines (voir le reste du
// projet : chaque module possède sa propre copie de ce genre de petit
// utilitaire, pour ne jamais faire dépendre un domaine d'un autre).
export async function resolveUniqueCuratedListSlug(
  tx: Prisma.TransactionClient,
  baseInput: string,
  excludeListId?: number,
): Promise<string> {
  const base = slugify(baseInput) || 'list';
  let candidate = base;
  let suffix = 2;

  while (await slugTaken(tx, candidate, excludeListId)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function slugTaken(
  tx: Prisma.TransactionClient,
  slug: string,
  excludeListId?: number,
): Promise<boolean> {
  const existing = await tx.curatedList.findFirst({
    where: {
      slug,
      ...(excludeListId ? { id: { not: excludeListId } } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
}
