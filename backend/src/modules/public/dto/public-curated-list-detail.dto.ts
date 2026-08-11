import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicSpeakerListItemDto } from './public-speaker-list-item.dto';

// §B4 — RÈGLE CRITIQUE : `speakers` ne contient QUE des membres eux-mêmes
// publiés et visibles (filtré côté SERVEUR, dans la requête Prisma — voir
// PublicCuratedListsService#findBySlug), jamais un post-filtrage en
// mémoire. Réutilise PublicSpeakerListItemDto TEL QUEL (même mapper que
// GET /public/speakers) plutôt qu'une seconde projection qui pourrait
// diverger de la première avec le temps.
export class PublicCuratedListDetailDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: [PublicSpeakerListItemDto] })
  speakers!: PublicSpeakerListItemDto[];
}
