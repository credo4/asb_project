// Recherche assistée de speakers candidats (§1 du prompt d'extension) --
// PAS un score : l'API renvoie des critères satisfaits/non satisfaits en
// texte explicite (voir MatchingCandidateCriteriaDto), jamais réduits à un
// pourcentage ici.
//
// Volontairement PAS { data, meta } (voir MatchingCandidatesResponseDto
// côté API, commentée explicitement en ce sens) : cet endpoint n'est PAS
// paginé, donc PAS branché sur useApiList (qui exige ce contrat) --
// state local dans le composant appelant plutôt qu'un habillage forcé.
import { http } from '../lib/http';
import type { ApiResponse } from '../types/api-helpers';

export type MatchingCandidatesResponse = ApiResponse<
  '/admin/booking-requests/{id}/matching-candidates',
  'get'
>;
export type MatchingCandidate = MatchingCandidatesResponse['candidates'][number];

export interface MatchingCriteria {
  pillar?: string;
  theme?: string;
  format?: string;
  language?: string;
  country?: string;
  eventDate?: string;
  eventEndDate?: string;
  isVirtual?: boolean;
  includeUnpublished?: boolean;
}

export async function fetchMatchingCandidates(
  bookingRequestId: number,
  criteria: MatchingCriteria,
): Promise<MatchingCandidatesResponse> {
  const { data } = await http.get<MatchingCandidatesResponse>(
    `/admin/booking-requests/${bookingRequestId}/matching-candidates`,
    { params: criteria },
  );
  return data;
}
