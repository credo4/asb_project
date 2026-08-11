import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicPillarThemeDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

// Contenu éditorial du pilier (voir schema.prisma : géré comme du contenu
// public, base du futur CMS en Phase 4) — pas de champ interdit ici.
export class PublicPillarDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  color!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  intro!: string | null;

  @ApiPropertyOptional({ nullable: true })
  problemStatement!: string | null;

  @ApiPropertyOptional({ nullable: true })
  valueProposition!: string | null;

  @ApiProperty({ type: [PublicPillarThemeDto] })
  themes!: PublicPillarThemeDto[];
}
