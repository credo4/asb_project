import { BookingStatus } from '@prisma/client';

// Graphe explicite des transitions autorisées (même approche que
// modules/speakers/status-transitions.util.ts) — UNE SEULE structure de
// données, jamais des `if` dispersés dans le service. Voir l'explication
// donnée à l'utilisateur : ajouter un statut dans 6 mois se résume à ajouter
// une entrée ici, jamais à traquer tous les endroits qui testaient déjà
// `status === X`.
//
// CANCELLED/DECLINED/CLOSED sont TERMINAUX (tableau vide) : cette matrice ne
// permet JAMAIS d'en sortir, y compris pour un SUPER_ADMIN. La réouverture
// est une action DÉLIBÉRÉMENT séparée (BookingRequestsService#reopen),
// réservée SUPER_ADMIN, journalisée — elle ne passe jamais par
// isBookingStatusTransitionAllowed().
//
// Hypothèse raisonnable de workflow linéaire avec sortie de secours
// (CANCELLED/DECLINED) possible depuis quasiment tous les états actifs — à
// ajuster si le processus commercial réel de l'équipe diffère.
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  NEW: [
    BookingStatus.TO_QUALIFY,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
  TO_QUALIFY: [
    BookingStatus.UNDER_ANALYSIS,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
  UNDER_ANALYSIS: [
    BookingStatus.SELECTING_SPEAKERS,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
  SELECTING_SPEAKERS: [
    BookingStatus.PROPOSAL_SENT,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
  PROPOSAL_SENT: [
    BookingStatus.AWAITING_CLIENT,
    BookingStatus.AWAITING_SPEAKER,
    BookingStatus.NEGOTIATING,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
  AWAITING_CLIENT: [
    BookingStatus.NEGOTIATING,
    BookingStatus.PROPOSAL_SENT,
    BookingStatus.CONFIRMED,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
  AWAITING_SPEAKER: [
    BookingStatus.NEGOTIATING,
    BookingStatus.PROPOSAL_SENT,
    BookingStatus.CONFIRMED,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
  NEGOTIATING: [
    BookingStatus.CONFIRMED,
    BookingStatus.PROPOSAL_SENT,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
  CONFIRMED: [BookingStatus.CONTRACT_IN_PREPARATION, BookingStatus.CANCELLED],
  CONTRACT_IN_PREPARATION: [BookingStatus.CLOSED, BookingStatus.CANCELLED],
  CANCELLED: [],
  DECLINED: [],
  CLOSED: [],
};

export const TERMINAL_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.DECLINED,
  BookingStatus.CLOSED,
];

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return TERMINAL_BOOKING_STATUSES.includes(status);
}

export function isBookingStatusTransitionAllowed(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  if (from === to) {
    return true; // no-op toléré (idempotent)
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// Utilisé par le service pour construire un message d'erreur qui liste les
// options valides — pas juste "transition refusée".
export function getAllowedTransitions(from: BookingStatus): BookingStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
