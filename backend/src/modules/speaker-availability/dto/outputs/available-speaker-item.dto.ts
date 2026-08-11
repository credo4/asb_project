import { AvailabilityStatus } from '../../availability-check.types';

// Projection délibérément légère (pas le profil complet) : conçue pour être
// consommée directement par le matching de la Phase 3, qui a besoin d'assez
// d'info pour afficher une liste de candidats, pas d'une fiche complète.
export class AvailableSpeakerRefDto {
  id!: number;
  displayName!: string;
  slug!: string | null;
  profilePhotoUrl!: string | null;
}

export class AvailableSpeakerItemDto {
  speaker!: AvailableSpeakerRefDto;
  // Jamais 'UNAVAILABLE' ici : ce statut exclut le speaker du résultat (voir
  // SpeakerAvailabilityService#searchAvailableSpeakers) — seuls AVAILABLE et
  // UNKNOWN peuvent apparaître dans cette liste.
  status!: Exclude<AvailabilityStatus, 'UNAVAILABLE'>;
  reasons!: string[];
}
