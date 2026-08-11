// Cf. cahier des charges §17 + prompt de spécification Phase 2, étape 2d.
export const MAX_ACTIVE_PERIODS_PER_SPEAKER = 200;

// 2 ans, hypothèse raisonnable pour "durée maximale d'une période" (365*2 +
// 1 jour pour couvrir une année bissextile dans l'intervalle) — le prompt ne
// précise pas la formule exacte, un jour de marge ne change rien en pratique.
export const MAX_PERIOD_DURATION_DAYS = 731;
