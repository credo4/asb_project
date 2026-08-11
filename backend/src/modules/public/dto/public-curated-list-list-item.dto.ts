import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Allow-list stricte, même principe que les autres DTOs publics (CLAUDE.md
// §5) : ni id interne, ni status, ni selectionMode, ni timestamps internes.
export class PublicCuratedListListItemDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty()
  displayOrder!: number;
}

// Même modèle de réponse que PublicSpeakerListResponseDto (consolidation
// avant 3d, suite à retour d'intégration) : les deux ressources listées
// publiquement (`/public/speakers`, `/public/curated-lists`) partagent le
// même contrat `{ data, meta }` — un seul mental model côté intégrateur,
// même pour une ressource courte comme celle-ci plutôt qu'un tableau nu.
export class PublicCuratedListListMetaDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  perPage!: number;
}

export class PublicCuratedListListResponseDto {
  @ApiProperty({ type: [PublicCuratedListListItemDto] })
  data!: PublicCuratedListListItemDto[];

  @ApiProperty({ type: PublicCuratedListListMetaDto })
  meta!: PublicCuratedListListMetaDto;
}
