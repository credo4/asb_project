// Rapports et statistiques (§14, ligne 5.13).
//
// ⚠️ AGRÉGATION À LA VOLÉE, JAMAIS DE COMPTEUR DÉNORMALISÉ (§A1) : tous les
// indicateurs de ce module sont calculés à chaque requête, comme
// isOverdue/checklistProgressPercent/le score agrégé des candidatures
// ailleurs dans ce projet. Seuil de revue explicite : au-delà d'environ
// 100 000 lignes dans analytics_events (l'ordre de grandeur qui rendrait un
// GROUP BY notablement plus lent qu'instantané), il faudra reconsidérer
// (vue matérialisée, agrégat pré-calculé rafraîchi périodiquement) — pas
// construit par anticipation.

// Fenêtre de dédoublonnage des vues de profil (§A1) : une même empreinte
// visiteur qui revoit le même profil dans les 30 minutes compte pour UNE
// seule vue. Fait DANS la requête SQL (fonction fenêtrée LAG), jamais en
// post-traitement JS — voir ReportsService#buildProfileViewsCte.
export const VIEW_DEDUP_WINDOW_MINUTES = 30;

// Fuseau horaire des agrégations par jour (§A1). Pas de champ dédié dans
// app_settings au moment de ce module (Partie A des Paramètres ne l'a pas
// demandé) — UTC est la valeur de repli EXPLICITEMENT sanctionnée par le
// prompt ("ou UTC par défaut"). Documenté dans chaque réponse
// (`meta.timezone`) plutôt que supposé implicitement.
export const REPORTS_TIMEZONE = 'UTC';

// Période par défaut quand `from`/`to` sont omis : 30 derniers jours,
// cohérent avec le raccourci "30 derniers jours" de la Partie B.
export const DEFAULT_PERIOD_DAYS = 30;

// §A3 — statuts de mission comptant comme chiffre d'affaires RÉALISÉ
// (l'engagement a eu lieu, même si le paiement admin traîne encore) —
// distinct du PRÉVISIONNEL (CONFIRMED seul, pas encore livré). Voir
// mission-status-transitions.util.ts pour l'ordre complet des statuts.
export const REALIZED_MISSION_STATUSES = [
  'DELIVERED',
  'SPEAKER_PAYMENT_PENDING',
  'COMPLETED',
] as const;
export const FORECAST_MISSION_STATUSES = ['CONFIRMED'] as const;

// §A3 — dénominateur EXPLICITE du taux de conversion commercial : cohorte
// des demandes CRÉÉES sur la période demandée, converties si au moins une
// mission en est issue depuis (indépendamment de la date de la mission
// elle-même). Documenté texto dans la réponse (`conversionRateDefinition`)
// plutôt que supposé — "un taux dont on ignore la base est ininterprétable".
export const CONVERSION_RATE_DEFINITION =
  'Demandes créées sur la période ayant donné lieu à au moins une mission, ' +
  'rapportées au nombre total de demandes créées sur la période.';

// Taux d'acceptation d'une sollicitation de disponibilité (§14.1, par
// speaker) : parmi les sollicitations ayant reçu une réponse (le speaker
// ne s'est pas contenté d'ignorer/laisser expirer), la part de réponses
// positives (avec ou sans conditions). Les sollicitations encore SENT sans
// réponse sont exclues du dénominateur — répondre "non" et ne pas répondre
// du tout ne sont pas la même chose.
export const ACCEPTANCE_RESPONSE_STATUSES = [
  'AVAILABLE_INTERESTED',
  'AVAILABLE_WITH_CONDITIONS',
] as const;
