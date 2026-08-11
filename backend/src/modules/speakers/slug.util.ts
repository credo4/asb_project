import { Prisma } from '@prisma/client';

// Plage Unicode des diacritiques combinants (accents), après normalisation
// NFD : "é" devient "e" + U+0301 (accent aigu combinant), qu'on retire ici.
const DIACRITICS_REGEX = /[̀-ͯ]/g;

// minuscules, sans accents, mots séparés par des tirets simples.
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Ajoute un suffixe numérique (-2, -3, ...) tant que le slug est déjà pris.
// `excludeSpeakerId` sert pour une mise à jour : ne pas se comparer à soi-même.
export async function resolveUniqueSlug(
  tx: Prisma.TransactionClient,
  baseInput: string,
  excludeSpeakerId?: number,
): Promise<string> {
  const base = slugify(baseInput) || 'speaker';
  let candidate = base;
  let suffix = 2;

  while (await slugTaken(tx, candidate, excludeSpeakerId)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function slugTaken(
  tx: Prisma.TransactionClient,
  slug: string,
  excludeSpeakerId?: number,
): Promise<boolean> {
  const existing = await tx.speaker.findFirst({
    where: {
      slug,
      ...(excludeSpeakerId ? { id: { not: excludeSpeakerId } } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
}
