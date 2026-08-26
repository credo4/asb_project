// Valeurs de repli (§A4) — utilisées quand la ligne app_settings n'existe
// pas encore, ou qu'un champ précis y est resté NULL (pas encore configuré
// par un SUPER_ADMIN). Ne remplacent PAS purement et simplement l'ancien
// mécanisme : `teamEmail` retombe d'abord sur ASB_TEAM_EMAIL (.env, voir
// AppSettingsService#getEffectiveSettings), ces constantes-ci ne sont que
// le DERNIER filet, si même la variable d'environnement est absente.
export const DEFAULT_AGENCY_NAME = 'Africa Speakers Bureau';
export const DEFAULT_CURRENCY = 'USD';
// §A4 — n'alimente PAS le SLA des 5 types de service existants (voir
// RESPONSE_SLA_BUSINESS_DAYS, booking-request.constants.ts) : sert
// uniquement de repli pour un futur type de service sans entrée dédiée.
export const DEFAULT_RESPONSE_SLA_BUSINESS_DAYS = 5;
