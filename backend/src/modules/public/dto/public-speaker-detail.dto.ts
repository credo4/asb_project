import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeeTierPublic, LanguageProficiency, MediaType } from '@prisma/client';
import {
  PublicCountryRefDto,
  PublicFormatRefDto,
  PublicLanguageRefDto,
  PublicPillarRefDto,
  PublicThemeRefDto,
} from './outputs/reference.dto';

export class PublicSpeakerPillarDto {
  @ApiProperty({ type: PublicPillarRefDto })
  pillar!: PublicPillarRefDto;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiProperty()
  displayOrder!: number;
}

export class PublicSpeakerLanguageDto {
  @ApiProperty({ type: PublicLanguageRefDto })
  language!: PublicLanguageRefDto;

  @ApiProperty({ enum: LanguageProficiency })
  proficiency!: LanguageProficiency;

  @ApiProperty()
  canPresent!: boolean;

  @ApiProperty()
  canQa!: boolean;

  @ApiProperty()
  canModerate!: boolean;
}

export class PublicEngagementDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  eventName!: string;

  @ApiPropertyOptional({ nullable: true })
  organization!: string | null;

  @ApiPropertyOptional({ type: PublicCountryRefDto, nullable: true })
  country!: PublicCountryRefDto | null;

  @ApiPropertyOptional({ nullable: true })
  eventDate!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  dateLabel!: string | null;

  @ApiPropertyOptional({ nullable: true })
  role!: string | null;

  @ApiPropertyOptional({ nullable: true })
  topic!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  photoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  videoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  externalUrl!: string | null;

  @ApiProperty()
  displayOrder!: number;
}

// Pas de `filePath` : ce champ interne peut contenir un chemin disque, il
// n'a rien à faire dans une réponse publique — `url` est le seul champ
// destiné à être consommé par le site public.
export class PublicMediaDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ enum: MediaType })
  type!: MediaType;

  @ApiPropertyOptional({ nullable: true })
  title!: string | null;

  @ApiPropertyOptional({ nullable: true })
  url!: string | null;

  @ApiProperty()
  displayOrder!: number;
}

// Allow-list STRICTE (voir CLAUDE.md §5). N'ajoute jamais un champ ici sans
// vérifier qu'il ne fait pas partie de la liste interdite : speaker_pricing,
// email, phone, internalNotes, userId, completionScore, status, timestamps
// internes, nationalité, médias privés.
export class PublicSpeakerDetailDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  professionalTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  currentOrganization!: string | null;

  @ApiPropertyOptional({ nullable: true })
  currentPosition!: string | null;

  @ApiPropertyOptional({ nullable: true })
  profilePhotoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  coverPhotoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  shortBio!: string | null;

  @ApiPropertyOptional({ nullable: true })
  fullBio!: string | null;

  @ApiPropertyOptional({ nullable: true })
  quote!: string | null;

  @ApiPropertyOptional({ nullable: true })
  expertiseSummary!: string | null;

  @ApiPropertyOptional({ nullable: true })
  valueProposition!: string | null;

  @ApiPropertyOptional({ nullable: true })
  careerPath!: string | null;

  @ApiPropertyOptional({ nullable: true })
  keyAchievements!: string | null;

  @ApiPropertyOptional({ nullable: true })
  awards!: string | null;

  @ApiPropertyOptional({ nullable: true })
  websiteUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  linkedinUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  socialLinks!: Record<string, string> | null;

  // Présent UNIQUEMENT si showBudget = true (clé absente sinon, voir mapper).
  @ApiPropertyOptional({ enum: FeeTierPublic })
  feeTierPublic?: FeeTierPublic;

  // Présents UNIQUEMENT si showLocation = true (clés absentes sinon).
  @ApiPropertyOptional({ type: PublicCountryRefDto })
  country?: PublicCountryRefDto | null;

  @ApiPropertyOptional()
  city?: string | null;

  @ApiProperty({
    type: [PublicSpeakerPillarDto],
    description: 'Max 3, ordonnés',
  })
  pillars!: PublicSpeakerPillarDto[];

  @ApiProperty({ type: [PublicThemeRefDto] })
  themes!: PublicThemeRefDto[];

  @ApiProperty({ type: [PublicFormatRefDto] })
  formats!: PublicFormatRefDto[];

  @ApiProperty({ type: [PublicSpeakerLanguageDto] })
  languages!: PublicSpeakerLanguageDto[];

  @ApiProperty({ type: [PublicEngagementDto] })
  engagements!: PublicEngagementDto[];

  @ApiProperty({
    type: [PublicMediaDto],
    description: 'Uniquement isPublic = true',
  })
  media!: PublicMediaDto[];
}
