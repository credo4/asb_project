import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AvailabilityPeriodType } from '@prisma/client';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Partiel : une clé absente laisse la valeur existante inchangée (même
// sémantique que les PATCH ailleurs dans le projet — voir UpdateMediaDto).
export class UpdatePeriodDto {
  @IsOptional()
  @IsEnum(AvailabilityPeriodType)
  type?: AvailabilityPeriodType;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'startDate doit être au format YYYY-MM-DD.',
  })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'endDate doit être au format YYYY-MM-DD.',
  })
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
