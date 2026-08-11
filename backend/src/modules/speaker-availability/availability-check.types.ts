// 'UNKNOWN' n'existe pas comme valeur en base (voir AvailabilityPeriodType) :
// c'est une conclusion du SERVICE, réservée au speaker qui n'a rien déclaré
// du tout (ni période, ni préférences) — cf. §1/§5 du prompt de spec.
export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';

export interface AvailabilityCheckResult {
  status: AvailabilityStatus;
  reasons: string[];
}
