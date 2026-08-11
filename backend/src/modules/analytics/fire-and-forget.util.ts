// Garantit qu'un appel « fire and forget » ne peut JAMAIS faire échouer la
// requête HTTP qui l'a déclenché (§B4) — ni par un throw SYNCHRONE (avant
// même la création de la promesse), ni par un rejet ASYNCHRONE. C'est un
// DEUXIÈME filet de sécurité : AnalyticsService#record capture déjà ses
// propres erreurs en interne, mais un appelant ne doit pas avoir à s'y fier
// aveuglément (ex. un test qui remplace le service par un mock défaillant,
// ou un futur appelant qui oublierait ce filet interne). Un problème
// d'analytics ne doit jamais empêcher un visiteur de voir un profil.
export function fireAndForget(fn: () => Promise<void>): void {
  try {
    void fn().catch(() => {
      // Déjà logué dans AnalyticsService — dernier filet, on avale.
    });
  } catch {
    // Throw synchrone (avant la création de la promesse) — même traitement.
  }
}
