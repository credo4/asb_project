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
