import { BookingRequestSpeakerStatus } from '@prisma/client';

// Phase 3d, §2 — même pattern que booking-request-status-transitions.util.ts
// et roster-application-status-transitions.util.ts : UNE SEULE structure de
// données, jamais des `if` dispersés dans le service.
//
// Hypothèse raisonnable de workflow (à ajuster si le processus réel de
// l'équipe diffère) : shortlist -> sollicitation de disponibilité -> réponse
// du speaker -> proposition au client -> décision du client. WITHDRAWN est
// une sortie possible depuis presque tous les états actifs (l'équipe peut
// retirer un candidat à tout moment, pas seulement après une réponse) ;
// CLIENT_DECLINED et SELECTED sont TERMINAUX — un candidat refusé ou
// sélectionné ne change plus de statut dans ce module (la mission, Phase 3e,
// est hors périmètre ici).
const ALLOWED_TRANSITIONS: Record<
  BookingRequestSpeakerStatus,
  BookingRequestSpeakerStatus[]
> = {
  SHORTLISTED: [
    BookingRequestSpeakerStatus.AVAILABILITY_REQUESTED,
    BookingRequestSpeakerStatus.WITHDRAWN,
  ],
  AVAILABILITY_REQUESTED: [
    BookingRequestSpeakerStatus.SPEAKER_AVAILABLE,
    BookingRequestSpeakerStatus.SPEAKER_AVAILABLE_WITH_CONDITIONS,
    BookingRequestSpeakerStatus.SPEAKER_UNAVAILABLE,
    BookingRequestSpeakerStatus.SPEAKER_NEEDS_INFO,
    BookingRequestSpeakerStatus.WITHDRAWN,
  ],
  SPEAKER_NEEDS_INFO: [
    // Ré-sollicitation possible après clarification, sans repasser par
    // SHORTLISTED — le speaker a déjà été contacté une fois.
    BookingRequestSpeakerStatus.AVAILABILITY_REQUESTED,
    BookingRequestSpeakerStatus.WITHDRAWN,
  ],
  SPEAKER_AVAILABLE: [
    BookingRequestSpeakerStatus.PROPOSED_TO_CLIENT,
    BookingRequestSpeakerStatus.WITHDRAWN,
  ],
  SPEAKER_AVAILABLE_WITH_CONDITIONS: [
    BookingRequestSpeakerStatus.PROPOSED_TO_CLIENT,
    BookingRequestSpeakerStatus.WITHDRAWN,
  ],
  SPEAKER_UNAVAILABLE: [
    // Pas de retour arrière depuis "indisponible" : le remplacement (§7)
    // crée une NOUVELLE ligne pour le speaker de remplacement plutôt que de
    // faire revivre celle-ci — voir BookingRequestSpeakersService#replace.
    BookingRequestSpeakerStatus.WITHDRAWN,
  ],
  PROPOSED_TO_CLIENT: [
    BookingRequestSpeakerStatus.CLIENT_DECLINED,
    BookingRequestSpeakerStatus.SELECTED,
    BookingRequestSpeakerStatus.WITHDRAWN,
  ],
  CLIENT_DECLINED: [],
  SELECTED: [],
  WITHDRAWN: [],
};

export const TERMINAL_BOOKING_REQUEST_SPEAKER_STATUSES: BookingRequestSpeakerStatus[] =
  [
    BookingRequestSpeakerStatus.CLIENT_DECLINED,
    BookingRequestSpeakerStatus.SELECTED,
    BookingRequestSpeakerStatus.WITHDRAWN,
  ];

export function isBookingRequestSpeakerTransitionAllowed(
  from: BookingRequestSpeakerStatus,
  to: BookingRequestSpeakerStatus,
): boolean {
  if (from === to) {
    return true; // no-op toléré (idempotent)
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function getAllowedBookingRequestSpeakerTransitions(
  from: BookingRequestSpeakerStatus,
): BookingRequestSpeakerStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
