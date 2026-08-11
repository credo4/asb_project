import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { FeeTierPublic } from '@prisma/client';
import { PUBLIC_MAX_PER_PAGE } from '../public-speaker.constants';

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
}
