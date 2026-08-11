// Utilitaires de date PARTAGÉS par la validation des périodes et par
// evaluate-availability.util.ts — un seul endroit qui décide comment on
// parse/compare des dates "jour seul" (voir la note pédagogique dans
// SpeakerAvailabilityService sur DATE vs DATETIME : on ancre systématiquement
// à minuit UTC pour ne jamais laisser le fuseau horaire du serveur ou du
// client se glisser dans la comparaison).

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Les DTO valident le format "YYYY-MM-DD" en amont (voir @Matches dans
// create-period.dto.ts) : on peut ancrer sans ambiguïté à minuit UTC, plutôt
// que de laisser `new Date("2026-09-01")` (déjà UTC en JS pour ce format,
// mais on le rend explicite pour ne pas dépendre de ce détail peu connu du
// moteur JS) dépendre d'une interprétation implicite.
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// Bornes INCLUSIVES des deux côtés (voir schema.prisma) : deux intervalles
// se chevauchent si l'un commence avant (ou le jour même) que l'autre finit,
// et inversement.
export function periodsOverlap(
  a: { startDate: Date; endDate: Date },
  b: { startDate: Date; endDate: Date },
): boolean {
  return a.startDate <= b.endDate && a.endDate >= b.startDate;
}
