import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AvailabilityRequestStatus,
  AvailabilityResponseStatus,
} from '@prisma/client';

// ⚠️ FRONTIÈRE ADMIN <-> SPEAKER — POINT CRITIQUE DE L'ÉTAPE 3d (§3.1).
// Allow-list STRICTE, même philosophie que les DTOs publics (CLAUDE.md §5) :
// ce que voit le speaker sur SA propre sollicitation, RIEN d'autre.
//
// N'EXISTENT DÉLIBÉRÉMENT PAS ici (et n'existeront JAMAIS sur ce DTO,
// contrairement au DTO admin) :
//   - bookingRequestId / toute référence à la demande client elle-même
//   - l'identité du client ou de son organisation
//   - le budget ANNONCÉ PAR LE CLIENT (estimatedBudget de BookingRequest)
//   - les notes internes de l'équipe sur la demande ou sur ce candidat
//   - la commission de l'agence
//   - la liste des autres speakers sollicités pour la même demande
//   - les évaluations (sans rapport, mais même principe de cloisonnement)
// `proposedFeeAmount`/`proposedFeeCurrency` SONT exposés : c'est LA
// rémunération proposée POUR CE speaker, légitimement la sienne (§3.1).
//
// Testé par TestAvailabilityRequestBriefingSerialization (voir
// availability-requests.e2e-spec.ts) : la sérialisation JSON COMPLÈTE de ce
// DTO est parcourue et échoue si un nom de clé interdit apparaît — pas une
// vérification champ par champ, qui pourrait oublier un futur champ ajouté
// par erreur.
export class AvailabilityRequestBriefingDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: AvailabilityRequestStatus })
  status!: AvailabilityRequestStatus;

  @ApiProperty()
  sentAt!: string;

  @ApiProperty()
  respondDueAt!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  eventDate!: string;

  @ApiPropertyOptional({ nullable: true })
  eventEndDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  locationCountryName!: string | null;

  @ApiProperty()
  isVirtual!: boolean;

  @ApiPropertyOptional({ nullable: true })
  durationMinutes!: number | null;

  @ApiProperty()
  topic!: string;

  @ApiPropertyOptional({ nullable: true })
  audienceDescription!: string | null;

  @ApiPropertyOptional({ nullable: true })
  audienceSize!: string | null;

  @ApiPropertyOptional({ nullable: true })
  language!: string | null;

  // Sa rémunération — légitime, c'est la sienne (§3.1).
  @ApiPropertyOptional({ nullable: true })
  proposedFeeAmount!: string | null;

  @ApiPropertyOptional({ nullable: true })
  proposedFeeCurrency!: string | null;

  @ApiPropertyOptional({ nullable: true })
  travelConditions!: string | null;

  @ApiPropertyOptional({ nullable: true })
  additionalNotes!: string | null;

  // Sa PROPRE réponse, si déjà donnée — c'est la sienne, pas une donnée
  // d'un tiers (voir speakerPrivateComment : lisible par son AUTEUR).
  @ApiPropertyOptional({ enum: AvailabilityResponseStatus, nullable: true })
  responseStatus!: AvailabilityResponseStatus | null;

  @ApiPropertyOptional({ nullable: true })
  respondedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  speakerPrivateComment!: string | null;
}
