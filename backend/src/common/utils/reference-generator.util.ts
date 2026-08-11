import { Prisma } from '@prisma/client';

// Génère un identifiant lisible du type "ASB-2026-000123" et le persiste de
// façon garantie unique, même si deux soumissions arrivent en même temps.
//
// Stratégie : `countForYear` donne un numéro de séquence qui a l'air
// naturellement croissant dans l'usage normal (basé sur le nombre
// d'enregistrements déjà créés cette année), MAIS ce n'est qu'un point de
// départ — la vraie garantie d'unicité vient de la contrainte `@unique` sur
// la colonne `reference` en base. Si deux requêtes concurrentes lisent le
// même `count` (race condition classique lecture-puis-écriture), Prisma
// renverra une erreur P2002 sur l'une des deux créations : on retente alors
// avec le numéro suivant plutôt que de laisser planter la requête.
export async function createWithUniqueReference<T>(params: {
  prefix: string;
  countForYear: (year: number) => Promise<number>;
  attemptCreate: (reference: string) => Promise<T>;
  maxAttempts?: number;
}): Promise<T> {
  const { prefix, countForYear, attemptCreate, maxAttempts = 5 } = params;
  const year = new Date().getFullYear();
  const baseCount = await countForYear(year);

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const sequence = (baseCount + 1 + attempt).toString().padStart(6, '0');
    const reference = `${prefix}-${year}-${sequence}`;

    try {
      return await attemptCreate(reference);
    } catch (error) {
      if (isUniqueReferenceConflict(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        `Impossible de générer une référence unique après ${maxAttempts} tentatives (préfixe ${prefix}).`,
      );
}

// Sur Postgres, Prisma renvoie `meta.target` comme un TABLEAU de noms de
// colonnes (ex. ['reference']). Sur MySQL (ce projet, cf. CLAUDE.md §3),
// Prisma renvoie à la place le NOM DE LA CONTRAINTE sous forme de STRING
// (ex. "booking_requests_reference_key") — `Array.isArray(target)` y est
// donc TOUJOURS false, ce qui désactivait silencieusement toute la logique
// de retry sur ce provider : un vrai conflit de référence concurrent
// remontait en 500 brut au lieu d'être rattrapé. Découvert via deux
// soumissions concurrentes lancées depuis tools/api-smoke-test contre une
// vraie base MySQL — les tests e2e (maxWorkers=1, cf. jest-e2e.json) ne
// pouvaient pas l'exposer. Les deux formes sont donc vérifiées ici.
function isUniqueReferenceConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== 'P2002') {
    return false;
  }
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  if (Array.isArray(target)) {
    return target.includes('reference');
  }
  if (typeof target === 'string') {
    return target.toLowerCase().includes('reference');
  }
  return false;
}
