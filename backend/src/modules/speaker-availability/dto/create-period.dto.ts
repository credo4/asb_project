import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AvailabilityPeriodType } from '@prisma/client';

// Format YYYY-MM-DD strict (pas @IsDateString, qui accepte tout ISO8601 y
// compris une heure/un fuseau) : les disponibilités sont une granularité
// "jour", jamais une heure précise — voir la note DATE vs DATETIME dans
// SpeakerAvailabilityService. Un champ "startDate=2026-09-01T23:00:00-05:00"
// resterait ambigu à convertir en DATE sans réintroduire le piège des fuseaux
// horaires qu'on cherche justement à éviter.
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePeriodDto {
  @IsEnum(AvailabilityPeriodType)
  type!: AvailabilityPeriodType;

  @Matches(DATE_ONLY_PATTERN, {
    message: 'startDate doit être au format YYYY-MM-DD.',
  })
  startDate!: string;

  @Matches(DATE_ONLY_PATTERN, {
    message: 'endDate doit être au format YYYY-MM-DD.',
  })
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
