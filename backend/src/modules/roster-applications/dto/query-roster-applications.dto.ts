import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

// §5.1 — filtres : statut, pays, admin assigné, plage de dates, score
// minimum, recherche texte. `minScore` s'applique sur le score AGRÉGÉ
// (calculé à la lecture depuis roster_application_evaluations, jamais
// stocké) : voir RosterApplicationsService#findAll pour la limite documentée
// de ce filtre (post-filtrage en mémoire, pas poussé en SQL).
export class QueryRosterApplicationsDto {
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
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedAdminId?: number;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minScore?: number;

  // Recherche texte : nom, organisation, email, référence.
  @IsOptional()
  @IsString()
  search?: string;
}
