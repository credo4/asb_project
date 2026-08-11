import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeeTierPublic } from '@prisma/client';
import {
  PublicCountryRefDto,
  PublicLanguageRefDto,
  PublicPillarRefDto,
} from './outputs/reference.dto';

// Projection LÉGÈRE pour la grille/liste (voir PublicSpeakerDetailDto pour
// le profil complet). Même allow-list stricte, sous-ensemble adapté à une
// carte de résultat.
export class PublicSpeakerListItemDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  professionalTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  currentOrganization!: string | null;

  @ApiPropertyOptional({ nullable: true })
  profilePhotoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  shortBio!: string | null;

  // Présents UNIQUEMENT si showLocation = true.
  @ApiPropertyOptional({ type: PublicCountryRefDto })
  country?: PublicCountryRefDto | null;

  @ApiPropertyOptional()
  city?: string | null;

  @ApiPropertyOptional({ type: PublicPillarRefDto, nullable: true })
  primaryPillar!: PublicPillarRefDto | null;

  @ApiProperty({ type: [PublicLanguageRefDto] })
  languages!: PublicLanguageRefDto[];

  // Présent UNIQUEMENT si showBudget = true.
  @ApiPropertyOptional({ enum: FeeTierPublic })
  feeTierPublic?: FeeTierPublic;
}

export class PublicSpeakerListMetaDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  perPage!: number;
}

export class PublicSpeakerListResponseDto {
  @ApiProperty({ type: [PublicSpeakerListItemDto] })
  data!: PublicSpeakerListItemDto[];

  @ApiProperty({ type: PublicSpeakerListMetaDto })
  meta!: PublicSpeakerListMetaDto;
}
