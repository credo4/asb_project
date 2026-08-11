import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { FeeTierPublic } from '@prisma/client';
import { PUBLIC_MAX_PER_PAGE } from '../public-speaker.constants';

// Partie A (consolidation) — ALLOW-LIST FERMÉE des critères de tri
// autorisés côté public. Deux raisons de ne JAMAIS accepter un nom de
// colonne libre venant du client :
//   1. Injection de tri : un nom de colonne arbitraire passé tel quel dans
//      un ORDER BY est une classe de vulnérabilité connue.
//   2. Fuite d'information PAR L'ORDRE des résultats : trier par un champ
//      jamais AFFICHÉ (ex. un tarif réel) permettrait de reconstituer un
//      classement, donc une estimation du tarif, sans jamais l'exposer
//      directement — l'invariant public/privé (CLAUDE.md §5) porte sur les
//      CHAMPS renvoyés, mais un tri sur un champ interne le contournerait
//      silencieusement. `@IsEnum` rejette (400) toute valeur hors de cette
//      liste : structurellement impossible de trier par un champ non listé
//      ici, quel que soit ce qui existe par ailleurs sur `Speaker`.
export enum PublicSpeakerSortBy {
  NAME = 'name',
  PUBLISHED_AT = 'publishedAt',
}

export enum PublicSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryPublicSpeakersDto {
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

  @ApiPropertyOptional({ description: 'Slug du pilier' })
  @IsOptional()
  @IsString()
  pillar?: string;

  @ApiPropertyOptional({ description: 'Slug du thème' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: 'Code ISO2 du pays' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Code langue (ex: "fr")' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Slug du format' })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ enum: FeeTierPublic })
  @IsOptional()
  @IsEnum(FeeTierPublic)
  feeTier?: FeeTierPublic;

  @ApiPropertyOptional({
    description: "Recherche texte : nom, titre, mots-clés, résumé d'expertise",
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: PublicSpeakerSortBy,
    description:
      'Absent = ordre par défaut (isTopRequested desc, isFeaturedHome desc, nom asc).',
  })
  @IsOptional()
  @IsEnum(PublicSpeakerSortBy)
  sortBy?: PublicSpeakerSortBy;

  @ApiPropertyOptional({
    enum: PublicSortOrder,
    description:
      'Ignoré si sortBy est absent. Défaut par champ : asc pour name, desc (plus récent en premier) pour publishedAt.',
  })
  @IsOptional()
  @IsEnum(PublicSortOrder)
  sortOrder?: PublicSortOrder;
}
