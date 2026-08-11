// Score agrégé d'une candidature (§2 du prompt Phase 3c) — CALCULÉ à la
// lecture, jamais stocké en dur (même principe que `isOverdue` sur
// BookingRequest, cf. CLAUDE.md §6). Isolé dans cette fonction dédiée pour
// pouvoir en ajuster la pondération plus tard sans toucher au reste du
// service (ex. pondérer différemment les 9 critères, ou le poids d'un
// évaluateur donné) — pour l'instant, poids égal partout.
//
// Formule : moyenne des 9 critères PAR évaluateur, puis moyenne de ces
// moyennes ENTRE évaluateurs (pas une moyenne globale de toutes les notes
// prises ensemble) — avec un poids égal par critère, les deux calculs
// donnent le même résultat, mais exprimer le calcul en deux étapes rend la
// pondération future (par critère ou par évaluateur) triviale à introduire
// sans changer la structure de la fonction.
export const EVALUATION_CRITERIA_KEYS = [
  'expertiseLevel',
  'professionalCredibility',
  'stageExperience',
  'speakingQuality',
  'internationalRelevance',
  'languageProficiency',
  'mediaQuality',
  'pillarFit',
  'commercialPotential',
] as const;

export type EvaluationCriteriaKey = (typeof EVALUATION_CRITERIA_KEYS)[number];

export type EvaluationCriteriaRow = Record<EvaluationCriteriaKey, number>;

export function computeEvaluatorScore(
  evaluation: EvaluationCriteriaRow,
): number {
  const sum = EVALUATION_CRITERIA_KEYS.reduce(
    (total, key) => total + evaluation[key],
    0,
  );
  return sum / EVALUATION_CRITERIA_KEYS.length;
}

// null = aucune évaluation encore soumise (pas 0 — on ne veut pas qu'une
// candidature non évaluée apparaisse pire qu'une candidature mal notée).
export function computeAggregatedScore(
  evaluations: EvaluationCriteriaRow[],
): number | null {
  if (evaluations.length === 0) {
    return null;
  }
  const perEvaluatorScores = evaluations.map(computeEvaluatorScore);
  const aggregate =
    perEvaluatorScores.reduce((total, score) => total + score, 0) /
    perEvaluatorScores.length;
  // Arrondi à 2 décimales — juste pour la lisibilité côté admin, ne change
  // rien au tri/filtre (comparaisons faites sur la valeur non arrondie en
  // amont si besoin).
  return Math.round(aggregate * 100) / 100;
}
