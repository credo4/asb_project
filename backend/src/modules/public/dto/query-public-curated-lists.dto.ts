import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PUBLIC_MAX_PER_PAGE } from '../public-speaker.constants';

// Pagination pour GET /public/curated-lists — mêmes défauts et mêmes
// bornes que QueryPublicSpeakersDto (réutilise PUBLIC_MAX_PER_PAGE) :
// deux ressources listées publiquement, un seul modèle de pagination à
// apprendre côté intégrateur. Pas de tri/filtre ici : le seul ordre
// public est `displayOrder asc` (choix éditorial de l'équipe ASB via
// l'admin), rien à trier côté client sur cette ressource.
export class QueryPublicCuratedListsDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: PUBLIC_MAX_PER_PAGE,
    default: 20,
    description: `Plafonné à ${PUBLIC_MAX_PER_PAGE}.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PUBLIC_MAX_PER_PAGE)
  perPage?: number = 20;
}
