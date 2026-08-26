// Un statut, un libellé, une famille — la table de correspondance vit dans
// le code, jamais dans les composants (règle du système de design, section
// « Badges de cycle de vie »). Familles : neutral / warn / info / success /
// danger / gold (« distinction » — réservée aux mises en avant, jamais un
// statut de cycle de vie à elle seule).
export type BadgeFamily =
  | 'neutral'
  | 'warn'
  | 'info'
  | 'success'
  | 'danger'
  | 'gold';

export interface SpeakerStatusInfo {
  label: string;
  family: BadgeFamily;
}

// Les 10 statuts de `SpeakerStatus` (voir backend/prisma/schema.prisma).
export const SPEAKER_STATUS: Record<string, SpeakerStatusInfo> = {
  DRAFT: { label: 'Brouillon', family: 'neutral' },
  INCOMPLETE: { label: 'Incomplet', family: 'neutral' },
  PENDING_VALIDATION: { label: 'En attente de validation', family: 'warn' },
  CHANGES_REQUESTED: { label: 'Corrections demandées', family: 'danger' },
  APPROVED: { label: 'Approuvé', family: 'info' },
  PUBLISHED: { label: 'Publié', family: 'success' },
  UNPUBLISHED: { label: 'Dépublié', family: 'neutral' },
  SUSPENDED: { label: 'Suspendu', family: 'danger' },
  ARCHIVED: { label: 'Archivé', family: 'neutral' },
  APPLICATION_REJECTED: { label: 'Candidature refusée', family: 'danger' },
};

export function speakerStatusInfo(status: string): SpeakerStatusInfo {
  return SPEAKER_STATUS[status] ?? { label: status, family: 'neutral' };
}

export const FEE_TIER_LABELS: Record<string, string> = {
  TIER_1: 'Niveau 1',
  TIER_2: 'Niveau 2',
  TIER_3: 'Niveau 3',
};

// Miroir de backend/src/modules/speakers/status-transitions.util.ts
// (ALLOWED_TRANSITIONS) — UNIQUEMENT pour ne proposer QUE des transitions
// plausibles dans le sélecteur (évite de présenter 10 options dont 7
// échoueraient). L'API reste la seule source de vérité : une divergence
// ici ne fait qu'afficher une option en trop, jamais un contournement de
// la règle réelle — le serveur refusera quand même une transition
// invalide, avec un message lisible (voir SpeakerDetailView).
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['INCOMPLETE', 'PENDING_VALIDATION', 'ARCHIVED'],
  INCOMPLETE: ['DRAFT', 'PENDING_VALIDATION', 'ARCHIVED'],
  PENDING_VALIDATION: ['APPROVED', 'CHANGES_REQUESTED', 'ARCHIVED'],
  CHANGES_REQUESTED: ['PENDING_VALIDATION', 'DRAFT', 'ARCHIVED'],
  APPROVED: ['PUBLISHED', 'CHANGES_REQUESTED', 'ARCHIVED'],
  PUBLISHED: ['UNPUBLISHED', 'SUSPENDED', 'ARCHIVED'],
  UNPUBLISHED: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
  SUSPENDED: ['PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
  APPLICATION_REJECTED: ['DRAFT'],
};

export function allowedNextStatuses(current: string): string[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}
