import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MissionContractStatus,
  MissionLogisticsStatus,
  MissionPaymentStatus,
} from '@prisma/client';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// §8 — "CRUD des champs" : tout ce qu'on peut éditer sur une mission SAUF
// le statut principal (PATCH .../status dédié, matrice de transitions —
// voir mission-status-transitions.util.ts). contractStatus/paymentStatus/
// logisticsStatus N'ONT PAS de matrice de transitions demandée (§2 : "ils
// évoluent indépendamment") — éditables librement ici, comme un simple
// champ, pas une machine à états.
export class UpdateMissionDto {
  @ApiPropertyOptional({ description: 'Format YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @ApiPropertyOptional({ description: 'Format HH:mm' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'startTime doit être au format HH:mm.' })
  startTime?: string;

  @ApiPropertyOptional({ description: 'Format HH:mm' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'endTime doit être au format HH:mm.' })
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  locationCountryId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  virtualLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  onSiteContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  onSiteContactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  format?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  participantCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  clientAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  speakerAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  agencyCommission?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  expenses?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: MissionContractStatus })
  @IsOptional()
  @IsEnum(MissionContractStatus)
  contractStatus?: MissionContractStatus;

  @ApiPropertyOptional({ enum: MissionPaymentStatus })
  @IsOptional()
  @IsEnum(MissionPaymentStatus)
  paymentStatus?: MissionPaymentStatus;

  @ApiPropertyOptional({ enum: MissionLogisticsStatus })
  @IsOptional()
  @IsEnum(MissionLogisticsStatus)
  logisticsStatus?: MissionLogisticsStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;
}
