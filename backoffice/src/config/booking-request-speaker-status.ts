import type { StatusInfo } from './booking-status';

// Les 10 statuts de `BookingRequestSpeakerStatus` (voir
// backend/prisma/schema.prisma) -- même ordre que l'énumération, qui
// correspond terme à terme à la liste donnée dans le prompt d'extension
// matching/disponibilité.
export const BOOKING_REQUEST_SPEAKER_STATUS: Record<string, StatusInfo> = {
  SHORTLISTED: { label: 'Sélectionné', family: 'neutral' },
  AVAILABILITY_REQUESTED: { label: 'Disponibilité demandée', family: 'warn' },
  SPEAKER_AVAILABLE: { label: 'Disponible', family: 'success' },
  SPEAKER_AVAILABLE_WITH_CONDITIONS: {
    label: 'Disponible sous conditions',
    family: 'warn',
  },
  SPEAKER_UNAVAILABLE: { label: 'Indisponible', family: 'danger' },
  SPEAKER_NEEDS_INFO: { label: 'Besoin de précisions', family: 'warn' },
  PROPOSED_TO_CLIENT: { label: 'Proposé au client', family: 'info' },
  CLIENT_DECLINED: { label: 'Refusé par le client', family: 'danger' },
  SELECTED: { label: 'Retenu', family: 'success' },
  WITHDRAWN: { label: 'Retiré', family: 'neutral' },
};

export function bookingRequestSpeakerStatusInfo(status: string): StatusInfo {
  return (
    BOOKING_REQUEST_SPEAKER_STATUS[status] ?? { label: status, family: 'neutral' }
  );
}
