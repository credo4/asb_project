import { SpeakerStatus } from '@prisma/client';
import { SpeakerDetailRow } from './speakers.includes';

// Graphe explicite des transitions autorisées. Choix délibérés :
// - ARCHIVED ne peut repartir que vers DRAFT (jamais directement PUBLISHED :
//   un profil archivé doit retraverser le workflow de revue).
// - APPLICATION_REJECTED (issu d'une candidature roster refusée) ne peut
//   redémarrer que vers DRAFT, si un admin décide de reconsidérer le profil.
// Ajustable ici sans toucher au reste du service si le workflow évolue.
const ALLOWED_TRANSITIONS: Record<SpeakerStatus, SpeakerStatus[]> = {
  DRAFT: [
    SpeakerStatus.INCOMPLETE,
    SpeakerStatus.PENDING_VALIDATION,
    SpeakerStatus.ARCHIVED,
  ],
  INCOMPLETE: [
    SpeakerStatus.DRAFT,
    SpeakerStatus.PENDING_VALIDATION,
    SpeakerStatus.ARCHIVED,
  ],
  PENDING_VALIDATION: [
    SpeakerStatus.APPROVED,
    SpeakerStatus.CHANGES_REQUESTED,
    SpeakerStatus.ARCHIVED,
  ],
  CHANGES_REQUESTED: [
    SpeakerStatus.PENDING_VALIDATION,
    SpeakerStatus.DRAFT,
    SpeakerStatus.ARCHIVED,
  ],
  APPROVED: [
    SpeakerStatus.PUBLISHED,
    SpeakerStatus.CHANGES_REQUESTED,
    SpeakerStatus.ARCHIVED,
  ],
  PUBLISHED: [
    SpeakerStatus.UNPUBLISHED,
    SpeakerStatus.SUSPENDED,
    SpeakerStatus.ARCHIVED,
  ],
  UNPUBLISHED: [
    SpeakerStatus.PUBLISHED,
    SpeakerStatus.DRAFT,
    SpeakerStatus.ARCHIVED,
  ],
  SUSPENDED: [
    SpeakerStatus.PUBLISHED,
    SpeakerStatus.UNPUBLISHED,
    SpeakerStatus.ARCHIVED,
  ],
  ARCHIVED: [SpeakerStatus.DRAFT],
  APPLICATION_REJECTED: [SpeakerStatus.DRAFT],
};

export function isTransitionAllowed(
  from: SpeakerStatus,
  to: SpeakerStatus,
): boolean {
  if (from === to) {
    return true; // no-op explicitement toléré (idempotent)
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// Champs indispensables à l'affichage public, vérifiés avant tout passage à
// PUBLISHED. Retourne la liste des libellés manquants (vide = OK).
export function getMissingPublishRequirements(
  speaker: SpeakerDetailRow,
): string[] {
  const missing: string[] = [];

  if (!speaker.slug || speaker.slug.trim().length === 0) {
    missing.push('slug');
  }
  const hasDisplayName =
    (speaker.publicName && speaker.publicName.trim().length > 0) ||
    (speaker.firstName.trim().length > 0 && speaker.lastName.trim().length > 0);
  if (!hasDisplayName) {
    missing.push('nom public (ou prénom + nom)');
  }
  if (!speaker.shortBio || speaker.shortBio.trim().length === 0) {
    missing.push('bio courte (shortBio)');
  }
  if (!speaker.profilePhotoUrl) {
    missing.push('photo de profil');
  }
  if (speaker.pillars.length === 0) {
    missing.push('au moins un pilier');
  }

  return missing;
}
