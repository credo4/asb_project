import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { TravelScope } from '@prisma/client';

// PUT = remplacement complet de la ressource (contrairement au PATCH
// partiel des périodes) : un champ optionnel absent retombe sur sa valeur
// par défaut du schéma, il ne "laisse pas la valeur existante inchangée".
// Voir SpeakerAvailabilityService#upsertPreferences.
export class UpsertTravelPreferencesDto {
  @IsEnum(TravelScope)
  travelScope!: TravelScope;

  // Requis UNIQUEMENT quand travelScope = SELECTED_COUNTRIES (sinon ignoré
  // côté service, même si fourni par erreur).
  @ValidateIf(
    (o: UpsertTravelPreferencesDto) =>
      o.travelScope === TravelScope.SELECTED_COUNTRIES,
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  countryIds?: number[];

  @IsOptional()
  @IsBoolean()
  availableForVirtual?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  minimumNoticeDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
