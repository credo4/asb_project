import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// §3.1/§3.2 — l'admin COMPOSE ici le briefing qui sera envoyé au speaker :
// ces champs sont volontairement saisis explicitement (pas dérivés
// automatiquement de la demande client), copiés tels quels en colonnes
// propres sur AvailabilityRequest à la création (voir CLAUDE.md — frontière
// admin <-> speaker).
export class SendAvailabilityRequestDto {
  @ApiProperty()
  @IsInt()
  bookingRequestId!: number;

  @ApiProperty()
  @IsInt()
  speakerId!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  eventType!: string;

  @ApiProperty({ description: 'Format YYYY-MM-DD' })
  @IsDateString()
  eventDate!: string;

  @ApiPropertyOptional({ description: 'Format YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  eventEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  locationCountryId?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiProperty()
  @IsString()
  topic!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audienceDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  audienceSize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  language?: string;

  // La rémunération PROPOSÉE POUR CE speaker (§3.1) — jamais dérivée du
  // budget client, l'admin la saisit explicitement.
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  proposedFeeAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  proposedFeeCurrency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  travelConditions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  additionalNotes?: string;

  @ApiPropertyOptional({
    description:
      'Défaut : maintenant + AVAILABILITY_RESPONSE_TTL_DAYS jours. Format ISO 8601.',
  })
  @IsOptional()
  @IsDateString()
  respondDueAt?: string;
}
