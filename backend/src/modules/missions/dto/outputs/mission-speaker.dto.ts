import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MissionLogisticsStatus,
  MissionStatus,
  ServiceType,
} from '@prisma/client';

// ⚠️ FRONTIÈRE FINANCIÈRE — POINT CRITIQUE DE CETTE ÉTAPE (§5). Allow-list
// STRICTE, même philosophie que les DTOs publics (CLAUDE.md §5) et le
// briefing de sollicitation de la 3d (AvailabilityRequestBriefingDto).
//
// N'EXISTENT DÉLIBÉRÉMENT PAS ici (et n'existeront JAMAIS sur ce DTO,
// contrairement au DTO admin) : clientAmount, agencyCommission,
// internalNotes, organizationId/contactId bruts (le nom de l'organisation
// est exposé — voir plus bas pourquoi — mais jamais la fiche CRM
// complète), et bien sûr toute référence à une AUTRE mission.
//
// Deux champs additionnels volontairement EXCLUS bien que non cités
// explicitement dans le prompt : `contractStatus` et `paymentStatus`
// portent sur la relation financière agence <-> CLIENT (contrat commercial,
// paiement du client à l'agence) — exactement l'esprit de la règle
// ("découvrir la marge de l'agence détruirait la relation commerciale"),
// même si ce ne sont pas des montants. `logisticsStatus`, en revanche, EST
// exposé : purement opérationnel (préparation du déplacement/de la
// logistique sur site), le speaker a un intérêt légitime à le savoir.
//
// Le nom de l'organisation cliente EST exposé (contrairement à la 3d, où
// l'identité du client est explicitement interdite pendant la phase de
// SOLLICITATION) : à ce stade, la mission est acceptée — le speaker sait
// déjà pour qui il se déplace, cacher le nom de l'organisation n'aurait
// aucun sens opérationnel et ne protège rien (la marge, elle, reste
// cachée). Testé par sérialisation JSON complète (pas champ par champ) —
// voir missions.e2e-spec.ts.
export class MissionSpeakerDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  reference!: string;

  @ApiPropertyOptional({ nullable: true })
  organizationName!: string | null;

  @ApiProperty({ enum: ServiceType })
  serviceType!: ServiceType;

  @ApiProperty()
  eventDate!: string;

  @ApiPropertyOptional({ nullable: true })
  startTime!: string | null;

  @ApiPropertyOptional({ nullable: true })
  endTime!: string | null;

  @ApiPropertyOptional({ nullable: true })
  timezone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  locationCountryName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  address!: string | null;

  @ApiProperty()
  isVirtual!: boolean;

  @ApiPropertyOptional({ nullable: true })
  virtualLink!: string | null;

  @ApiPropertyOptional({ nullable: true })
  onSiteContactName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  onSiteContactPhone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  durationMinutes!: number | null;

  @ApiProperty()
  topic!: string;

  @ApiPropertyOptional({ nullable: true })
  language!: string | null;

  @ApiPropertyOptional({ nullable: true })
  format!: string | null;

  @ApiPropertyOptional({ nullable: true })
  participantCount!: number | null;

  // Sa rémunération — légitime, elle lui est due (§5).
  @ApiPropertyOptional({ nullable: true })
  speakerAmount!: string | null;

  @ApiPropertyOptional({ nullable: true })
  expenses!: string | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: MissionStatus })
  status!: MissionStatus;

  @ApiProperty({ enum: MissionLogisticsStatus })
  logisticsStatus!: MissionLogisticsStatus;

  @ApiPropertyOptional({ nullable: true })
  cancellationReason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  acceptedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  briefAcknowledgedAt!: string | null;
}
