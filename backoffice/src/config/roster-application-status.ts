import type { StatusInfo } from './booking-status';

// Les 9 statuts de `ApplicationStatus` (voir backend/prisma/schema.prisma).
export const APPLICATION_STATUS: Record<string, StatusInfo> = {
  NEW: { label: 'Reçue', family: 'warn' },
  UNDER_REVIEW: { label: "En cours d'examen", family: 'info' },
  INFO_REQUESTED: { label: 'Informations demandées', family: 'warn' },
  INTERVIEW_TO_SCHEDULE: { label: 'Entretien à planifier', family: 'info' },
  INTERVIEW_DONE: { label: 'Entretien réalisé', family: 'info' },
  APPROVED: { label: 'Retenue', family: 'success' },
  REJECTED: { label: 'Refusée', family: 'danger' },
  CONVERTED: { label: 'Convertie en speaker', family: 'success' },
  ARCHIVED: { label: 'Archivée', family: 'neutral' },
};

export function applicationStatusInfo(status: string): StatusInfo {
  return APPLICATION_STATUS[status] ?? { label: status, family: 'neutral' };
}

export const TERMINAL_APPLICATION_STATUSES = [
  'REJECTED',
  'ARCHIVED',
  'CONVERTED',
];
// CONVERTED est terminal mais jamais réouvrable (voir
// roster-application-status-transitions.util.ts) -- distinct de la liste
// ci-dessus, même principe que côté backend.
export const REOPENABLE_APPLICATION_STATUSES = ['REJECTED', 'ARCHIVED'];

// Miroir de backend/.../roster-application-status-transitions.util.ts --
// même avertissement que les autres config/*-status.ts de ce projet : l'API
// reste seule source de vérité. INFO_REQUESTED/REJECTED/CONVERTED sont
// volontairement ABSENTS des cibles ici (chacun a son propre endpoint dédié
// avec ses propres effets de bord -- voir UpdateRosterApplicationStatusDto).
const ALLOWED_GENERIC_TRANSITIONS: Record<string, string[]> = {
  NEW: ['UNDER_REVIEW', 'ARCHIVED'],
  UNDER_REVIEW: ['INTERVIEW_TO_SCHEDULE', 'APPROVED', 'ARCHIVED'],
  INFO_REQUESTED: ['UNDER_REVIEW', 'ARCHIVED'],
  INTERVIEW_TO_SCHEDULE: ['INTERVIEW_DONE', 'ARCHIVED'],
  INTERVIEW_DONE: ['APPROVED', 'ARCHIVED'],
  APPROVED: ['ARCHIVED'],
  REJECTED: [],
  CONVERTED: [],
  ARCHIVED: [],
};

export function allowedNextApplicationStatuses(current: string): string[] {
  return ALLOWED_GENERIC_TRANSITIONS[current] ?? [];
}

// Les 9 critères d'évaluation (§5.3 du cahier des charges, notés 1 à 5) --
// libellés FR pour l'écran, mêmes clés que CreateEvaluationDto côté API.
export const EVALUATION_CRITERIA: { key: string; label: string }[] = [
  { key: 'expertiseLevel', label: "Niveau d'expertise" },
  { key: 'professionalCredibility', label: 'Crédibilité professionnelle' },
  { key: 'stageExperience', label: 'Expérience de scène' },
  { key: 'speakingQuality', label: 'Qualité oratoire' },
  { key: 'internationalRelevance', label: 'Pertinence internationale' },
  { key: 'languageProficiency', label: 'Maîtrise linguistique' },
  { key: 'mediaQuality', label: 'Qualité des médias fournis' },
  { key: 'pillarFit', label: 'Adéquation au pilier' },
  { key: 'commercialPotential', label: 'Potentiel commercial' },
];
