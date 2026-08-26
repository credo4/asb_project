import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  MissionContractStatus,
  MissionPaymentStatus,
  MissionStatus,
} from '@prisma/client';

// Un query param booléen arrive toujours en string ("true"/"false") :
// `@Type(() => Boolean)` convertirait n'importe quelle chaîne non vide (y
// compris "false") en `true` — piège déjà rencontré ailleurs dans ce
// projet (voir query-available-speakers.dto.ts), d'où ce `toBoolean` local.
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

// §8 — liste paginée { data, meta }, mêmes filtres que demandé : statut,
// statut de contrat, statut de paiement, speaker, organisation, plage de
// dates, admin responsable, à venir / passées.
export class QueryMissionsDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  @ApiPropertyOptional({ enum: MissionStatus })
  @IsOptional()
  @IsEnum(MissionStatus)
  status?: MissionStatus;

  @ApiPropertyOptional({ enum: MissionContractStatus })
  @IsOptional()
  @IsEnum(MissionContractStatus)
  contractStatus?: MissionContractStatus;

  @ApiPropertyOptional({ enum: MissionPaymentStatus })
  @IsOptional()
  @IsEnum(MissionPaymentStatus)
  paymentStatus?: MissionPaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  speakerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organizationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  createdById?: number;

  @ApiPropertyOptional({ description: 'Format YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Format YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'eventDate >= maintenant (exclusif avec "past").',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  upcoming?: boolean;

  @ApiPropertyOptional({
    description: 'eventDate < maintenant (exclusif avec "upcoming").',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  past?: boolean;
}
