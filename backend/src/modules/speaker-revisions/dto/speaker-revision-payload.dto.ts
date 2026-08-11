import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PillarInputDto } from '../../speakers/dto/inputs/pillar-input.dto';
import { LanguageInputDto } from '../../speakers/dto/inputs/language-input.dto';
import { EngagementInputDto } from '../../speakers/dto/inputs/engagement-input.dto';
import { SocialLinksDto } from '../../speakers/dto/inputs/social-links.dto';

// Allow-list FERMÉE (voir speaker-revision.constants.ts) : tout champ hors de
// cette classe est rejeté par le ValidationPipe global
// (whitelist + forbidNonWhitelisted), donc AUCUN champ interdit — status,
// slug, isVisible, isFeaturedHome, isTopRequested, showBudget, allowIndexing,
// feeTierPublic, completionScore, userId, email, speaker_pricing — ne peut
// jamais transiter ici, même via un payload manipulé.
//
// Sémantique PATCH partiel, comme UpdateSpeakerDto : une clé absente du
// corps de requête laisse la valeur LIVE actuelle inchangée dans l'aperçu et
// à l'approbation ; un tableau vide [] remplace la relation par "aucune".
export class SpeakerRevisionPayloadDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  civility?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  publicName?: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @IsOptional()
  @IsInt()
  countryId?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  profilePhotoUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  coverPhotoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  professionalTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentOrganization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPosition?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  linkedinUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;

  @IsOptional()
  @IsString()
  shortBio?: string;

  @IsOptional()
  @IsString()
  fullBio?: string;

  @IsOptional()
  @IsString()
  quote?: string;

  @IsOptional()
  @IsString()
  expertiseSummary?: string;

  @IsOptional()
  @IsString()
  valueProposition?: string;

  @IsOptional()
  @IsString()
  careerPath?: string;

  @IsOptional()
  @IsString()
  keyAchievements?: string;

  @IsOptional()
  @IsString()
  awards?: string;

  // --- Relations (même stratégie de remplacement complet que UpdateSpeakerDto) ---
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PillarInputDto)
  pillars?: PillarInputDto[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  themeIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  formatIds?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LanguageInputDto)
  languages?: LanguageInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EngagementInputDto)
  engagements?: EngagementInputDto[];
}
