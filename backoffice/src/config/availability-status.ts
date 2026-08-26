import type { StatusInfo } from './booking-status';

// Cycle de vie D'UNE SOLLICITATION (AvailabilityRequestStatus, 4 valeurs) --
// distinct de la RÉPONSE du speaker (AvailabilityResponseStatus, ci-dessous).
export const AVAILABILITY_REQUEST_STATUS: Record<string, StatusInfo> = {
  SENT: { label: 'Envoyée — en attente de réponse', family: 'warn' },
  RESPONDED: { label: 'Répondue', family: 'success' },
  EXPIRED: { label: 'Expirée', family: 'neutral' },
  CANCELLED: { label: 'Annulée', family: 'neutral' },
};

export function availabilityRequestStatusInfo(status: string): StatusInfo {
  return (
    AVAILABILITY_REQUEST_STATUS[status] ?? { label: status, family: 'neutral' }
  );
}

// Réponse du speaker (AvailabilityResponseStatus, 4 valeurs) -- N'ENGAGE
// RIEN (voir CLAUDE.md §6) : même AVAILABLE_INTERESTED reste une
// expression d'intérêt, jamais une confirmation.
export const AVAILABILITY_RESPONSE_STATUS: Record<string, StatusInfo> = {
  AVAILABLE_INTERESTED: { label: 'Disponible, intéressé', family: 'success' },
  AVAILABLE_WITH_CONDITIONS: {
    label: 'Disponible sous conditions',
    family: 'warn',
  },
  UNAVAILABLE: { label: 'Indisponible', family: 'danger' },
  NEEDS_INFO: { label: "Besoin d'informations", family: 'warn' },
};

export function availabilityResponseStatusInfo(status: string): StatusInfo {
  return (
    AVAILABILITY_RESPONSE_STATUS[status] ?? { label: status, family: 'neutral' }
  );
}

// Verdict de disponibilité côté matching (AvailabilityStatus, 3 valeurs --
// voir MatchingCandidateAvailabilityDto). "Inconnu" traité de façon
// délibérément NEUTRE, jamais alarmante (prompt §2) : le speaker n'a rien
// déclaré, ce n'est pas un refus.
export const MATCHING_AVAILABILITY_STATUS: Record<string, StatusInfo> = {
  AVAILABLE: { label: 'Disponible', family: 'success' },
  UNAVAILABLE: { label: 'Indisponible', family: 'danger' },
  UNKNOWN: { label: 'Inconnu — aucune information déclarée', family: 'neutral' },
};

export function matchingAvailabilityStatusInfo(status: string): StatusInfo {
  return (
    MATCHING_AVAILABILITY_STATUS[status] ?? { label: status, family: 'neutral' }
  );
}
