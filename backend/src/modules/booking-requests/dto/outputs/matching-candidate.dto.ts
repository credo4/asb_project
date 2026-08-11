import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeeTierPublic, SpeakerStatus } from '@prisma/client';
import type { AvailabilityStatus } from '../../../speaker-availability/availability-check.types';

// Endpoint ADMIN — pas de restriction "allow-list publique" (CLAUDE.md §5)
// ici, mais toujours PAS de tarifs réels (`speaker_pricing`) : ce module
// n'a besoin QUE du niveau indicatif déjà utilisé côté public
// (`feeTierPublic`), affiché à titre informatif à côté du budget texte
// libre du client — jamais un vrai chiffre de speaker_pricing, qui n'a
// aucune raison d'être ici (le matching ne négocie rien).
export class MatchingCandidateSpeakerRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  slug!: string | null;

  @ApiPropertyOptional({ nullable: true })
  profilePhotoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  professionalTitle!: string | null;

  @ApiProperty({ enum: SpeakerStatus })
  status!: SpeakerStatus;

  @ApiPropertyOptional({ enum: FeeTierPublic, nullable: true })
  feeTierPublic!: FeeTierPublic | null;
}

export class MatchingCandidateAvailabilityDto {
  @ApiProperty({ enum: ['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN'] })
  status!: AvailabilityStatus;

  @ApiProperty({ type: [String] })
  reasons!: string[];
}

// §1 — PAS un score : une liste de critères satisfaits et une liste de
// critères non satisfaits, chacun en texte explicite ("Langue : oui" /
// "Pays : non (basé au Kenya, événement à Dakar)"), jamais un pourcentage.
export class MatchingCandidateCriteriaDto {
  @ApiProperty({ type: [String] })
  satisfied!: string[];

  @ApiProperty({ type: [String] })
  unsatisfied!: string[];
}

export class MatchingCandidateDto {
  @ApiProperty({ type: MatchingCandidateSpeakerRefDto })
  speaker!: MatchingCandidateSpeakerRefDto;

  @ApiProperty({ type: MatchingCandidateAvailabilityDto })
  availability!: MatchingCandidateAvailabilityDto;

  @ApiProperty({ type: MatchingCandidateCriteriaDto })
  criteria!: MatchingCandidateCriteriaDto;
}

// Champs texte libre de la demande, renvoyés TELS QUELS (voir
// QueryMatchingCandidatesDto) pour que l'admin les lise et tranche
// lui-même — le service ne les interprète ni ne les compare à rien.
export class MatchingRequestContextDto {
  @ApiPropertyOptional({ nullable: true })
  eventLocation!: string | null;

  @ApiPropertyOptional({ nullable: true })
  eventFormat!: string | null;

  @ApiPropertyOptional({ nullable: true })
  language!: string | null;

  @ApiPropertyOptional({ nullable: true })
  audienceSize!: string | null;

  @ApiPropertyOptional({ nullable: true })
  estimatedBudget!: string | null;
}

// Les critères RÉELLEMENT appliqués à cette recherche (après application
// des défauts — voir MatchingService#resolveCriteria) : utile côté admin
// pour savoir exactement ce qui a été évalué, notamment quand un critère
// n'a PAS pu être pré-rempli depuis la demande (voir
// QueryMatchingCandidatesDto).
export class MatchingCriteriaUsedDto {
  @ApiPropertyOptional({ nullable: true })
  pillar!: string | null;

  @ApiPropertyOptional({ nullable: true })
  theme!: string | null;

  @ApiPropertyOptional({ nullable: true })
  format!: string | null;

  @ApiPropertyOptional({ nullable: true })
  language!: string | null;

  @ApiPropertyOptional({ nullable: true })
  country!: string | null;

  @ApiProperty()
  eventDate!: string;

  @ApiProperty()
  eventEndDate!: string;

  @ApiProperty()
  isVirtual!: boolean;

  @ApiProperty()
  includeUnpublished!: boolean;
}

// Volontairement PAS { data, meta } (pas de pagination ici — même choix que
// GET /admin/speakers/available, cf. SpeakerAvailabilityService) : un nom
// de clé distinct (`candidates`) pour ne pas laisser croire à une liste
// paginée standard.
export class MatchingCandidatesResponseDto {
  @ApiProperty({ type: MatchingCriteriaUsedDto })
  criteriaUsed!: MatchingCriteriaUsedDto;

  @ApiProperty({ type: MatchingRequestContextDto })
  requestContext!: MatchingRequestContextDto;

  @ApiProperty({ type: [MatchingCandidateDto] })
  candidates!: MatchingCandidateDto[];
}
