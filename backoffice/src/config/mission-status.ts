import type { StatusInfo } from './booking-status';

// Les 14 valeurs de `MissionStatus` (voir backend/prisma/schema.prisma).
// 13 rangées dans un ORDRE TOTAL côté API (voir
// mission-status-transitions.util.ts) + CANCELLED, atteignable depuis tout
// statut non terminal, hors de cet ordre.
export const MISSION_STATUS: Record<string, StatusInfo> = {
  PREPARATION: { label: 'Préparation', family: 'neutral' },
  AVAILABILITY_CONFIRMED: { label: 'Disponibilité confirmée', family: 'info' },
  QUOTE_SENT: { label: 'Devis envoyé', family: 'info' },
  QUOTE_ACCEPTED: { label: 'Devis accepté', family: 'success' },
  CONTRACT_SENT: { label: 'Contrat envoyé', family: 'info' },
  CONTRACT_SIGNED: { label: 'Contrat signé', family: 'success' },
  DEPOSIT_EXPECTED: { label: 'Acompte attendu', family: 'warn' },
  DEPOSIT_RECEIVED: { label: 'Acompte reçu', family: 'success' },
  LOGISTICS_IN_PROGRESS: { label: 'Logistique en cours', family: 'info' },
  CONFIRMED: { label: 'Confirmée', family: 'success' },
  DELIVERED: { label: 'Réalisée', family: 'success' },
  SPEAKER_PAYMENT_PENDING: { label: 'Paiement speaker en attente', family: 'warn' },
  COMPLETED: { label: 'Terminée', family: 'success' },
  CANCELLED: { label: 'Annulée', family: 'danger' },
};

export function missionStatusInfo(status: string): StatusInfo {
  return MISSION_STATUS[status] ?? { label: status, family: 'neutral' };
}

export const TERMINAL_MISSION_STATUSES = ['COMPLETED', 'CANCELLED'];

// Miroir de backend/src/modules/missions/mission-status-transitions.util.ts
// -- même avertissement que les autres config/*-status.ts de ce projet :
// l'API reste seule source de vérité (voir MissionDetailView, qui affiche
// TOUJOURS le message renvoyé par l'API en cas de refus, jamais juste ce
// calcul local). Sert uniquement à ne proposer QUE des options plausibles
// dans le sélecteur, pas à valider quoi que ce soit soi-même : "en avant"
// (rang strictement supérieur) toujours permis, "en arrière" réservé
// SUPER_ADMIN, CANCELLED atteignable depuis tout statut non terminal.
const STATUS_ORDER = [
  'PREPARATION',
  'AVAILABILITY_CONFIRMED',
  'QUOTE_SENT',
  'QUOTE_ACCEPTED',
  'CONTRACT_SENT',
  'CONTRACT_SIGNED',
  'DEPOSIT_EXPECTED',
  'DEPOSIT_RECEIVED',
  'LOGISTICS_IN_PROGRESS',
  'CONFIRMED',
  'DELIVERED',
  'SPEAKER_PAYMENT_PENDING',
  'COMPLETED',
];

function rank(status: string): number {
  return STATUS_ORDER.indexOf(status);
}

export function allowedNextMissionStatuses(
  current: string,
  isSuperAdmin: boolean,
): string[] {
  if (TERMINAL_MISSION_STATUSES.includes(current)) return [];
  const currentRank = rank(current);
  const forward = STATUS_ORDER.filter((_, index) => index > currentRank);
  const backward = isSuperAdmin
    ? STATUS_ORDER.filter((_, index) => index < currentRank)
    : [];
  return [...forward, ...backward, 'CANCELLED'];
}

export const MISSION_CONTRACT_STATUS: Record<string, StatusInfo> = {
  PENDING: { label: 'En attente', family: 'neutral' },
  SENT: { label: 'Envoyé', family: 'info' },
  SIGNED: { label: 'Signé', family: 'success' },
};
export function missionContractStatusInfo(status: string): StatusInfo {
  return MISSION_CONTRACT_STATUS[status] ?? { label: status, family: 'neutral' };
}

export const MISSION_PAYMENT_STATUS: Record<string, StatusInfo> = {
  PENDING: { label: 'En attente', family: 'neutral' },
  DEPOSIT_RECEIVED: { label: 'Acompte reçu', family: 'warn' },
  FULLY_PAID: { label: 'Payé intégralement', family: 'success' },
};
export function missionPaymentStatusInfo(status: string): StatusInfo {
  return MISSION_PAYMENT_STATUS[status] ?? { label: status, family: 'neutral' };
}

export const MISSION_LOGISTICS_STATUS: Record<string, StatusInfo> = {
  PENDING: { label: 'En attente', family: 'neutral' },
  IN_PROGRESS: { label: 'En cours', family: 'info' },
  READY: { label: 'Prête', family: 'success' },
};
export function missionLogisticsStatusInfo(status: string): StatusInfo {
  return MISSION_LOGISTICS_STATUS[status] ?? { label: status, family: 'neutral' };
}

export const MISSION_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  BRIEF: 'Brief',
  CONTRACT: 'Contrat',
  SIGNED_CONTRACT: 'Contrat signé',
  PRESENTATION: 'Présentation',
  INVOICE: 'Facture',
  TRAVEL_INFO: 'Informations de voyage',
  OTHER: 'Autre',
};
