// Un statut, un libellé, une famille (même règle que speaker-status.ts).
export type BadgeFamily =
  | 'neutral'
  | 'warn'
  | 'info'
  | 'success'
  | 'danger'
  | 'gold';

export interface StatusInfo {
  label: string;
  family: BadgeFamily;
}

// Les 13 statuts de `BookingStatus` (voir backend/prisma/schema.prisma).
export const BOOKING_STATUS: Record<string, StatusInfo> = {
  NEW: { label: 'Nouvelle', family: 'warn' },
  TO_QUALIFY: { label: 'À qualifier', family: 'warn' },
  UNDER_ANALYSIS: { label: 'En analyse', family: 'info' },
  SELECTING_SPEAKERS: { label: 'Sélection des speakers', family: 'info' },
  PROPOSAL_SENT: { label: 'Proposition envoyée', family: 'info' },
  AWAITING_CLIENT: { label: 'En attente du client', family: 'warn' },
  AWAITING_SPEAKER: { label: 'En attente du speaker', family: 'warn' },
  NEGOTIATING: { label: 'En négociation', family: 'info' },
  CONFIRMED: { label: 'Confirmée', family: 'success' },
  CONTRACT_IN_PREPARATION: { label: 'Contrat en préparation', family: 'info' },
  CANCELLED: { label: 'Annulée', family: 'danger' },
  DECLINED: { label: 'Refusée', family: 'danger' },
  CLOSED: { label: 'Clôturée', family: 'success' },
};

export function bookingStatusInfo(status: string): StatusInfo {
  return BOOKING_STATUS[status] ?? { label: status, family: 'neutral' };
}

export const TERMINAL_BOOKING_STATUSES = ['CANCELLED', 'DECLINED', 'CLOSED'];

// Miroir de backend/src/modules/booking-requests/booking-request-status-
// transitions.util.ts (ALLOWED_TRANSITIONS) -- même principe et même
// avertissement que speaker-status.ts#allowedNextStatuses : l'API reste
// seule source de vérité, une divergence n'affiche qu'une option en trop.
// Statuts terminaux (tableau vide) : la réouverture est une action séparée
// (PATCH .../reopen, réservée SUPER_ADMIN), jamais une transition normale.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ['TO_QUALIFY', 'DECLINED', 'CANCELLED'],
  TO_QUALIFY: ['UNDER_ANALYSIS', 'DECLINED', 'CANCELLED'],
  UNDER_ANALYSIS: ['SELECTING_SPEAKERS', 'DECLINED', 'CANCELLED'],
  SELECTING_SPEAKERS: ['PROPOSAL_SENT', 'DECLINED', 'CANCELLED'],
  PROPOSAL_SENT: [
    'AWAITING_CLIENT',
    'AWAITING_SPEAKER',
    'NEGOTIATING',
    'DECLINED',
    'CANCELLED',
  ],
  AWAITING_CLIENT: [
    'NEGOTIATING',
    'PROPOSAL_SENT',
    'CONFIRMED',
    'DECLINED',
    'CANCELLED',
  ],
  AWAITING_SPEAKER: [
    'NEGOTIATING',
    'PROPOSAL_SENT',
    'CONFIRMED',
    'DECLINED',
    'CANCELLED',
  ],
  NEGOTIATING: ['CONFIRMED', 'PROPOSAL_SENT', 'DECLINED', 'CANCELLED'],
  CONFIRMED: ['CONTRACT_IN_PREPARATION', 'CANCELLED'],
  CONTRACT_IN_PREPARATION: ['CLOSED', 'CANCELLED'],
  CANCELLED: [],
  DECLINED: [],
  CLOSED: [],
};

export function allowedNextBookingStatuses(current: string): string[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export const PRIORITY_INFO: Record<string, StatusInfo> = {
  LOW: { label: 'Basse', family: 'neutral' },
  NORMAL: { label: 'Normale', family: 'info' },
  HIGH: { label: 'Haute', family: 'gold' },
  URGENT: { label: 'Critique', family: 'danger' },
};

export function priorityInfo(priority: string): StatusInfo {
  return PRIORITY_INFO[priority] ?? { label: priority, family: 'neutral' };
}

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  CONFERENCE: 'Conférence',
  MASTERCLASS: 'Masterclass',
  WEBINAR: 'Webinaire',
  ADVISORY: 'Conseil',
  ONE_TO_ONE: 'One-to-one',
};
