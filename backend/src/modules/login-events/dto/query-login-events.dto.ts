import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

// Même convention que QueryBookingRequestsDto#overdue : la query string
// arrive en `"true"`/`"false"`, jamais un booléen natif.
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class QueryLoginEventsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  success?: boolean;

  // Recherche sur l'email TENTÉ (pas forcément un compte existant — voir
  // LoginEvent.emailAttempted).
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
