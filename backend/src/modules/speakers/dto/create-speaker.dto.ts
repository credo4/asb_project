import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FeeTierPublic } from '@prisma/client';
import { SocialLinksDto } from './inputs/social-links.dto';
import { PillarInputDto } from './inputs/pillar-input.dto';
import { LanguageInputDto } from './inputs/language-input.dto';
import { PricingInputDto } from './inputs/pricing-input.dto';
import { EngagementInputDto } from './inputs/engagement-input.dto';
import { MediaInputDto } from './inputs/media-input.dto';

export class CreateSpeakerDto {
  // --- Identité ---
  @IsOptional()
  @IsString()
  @MaxLength(20)
  civility?: string;

  @IsString()
  @MaxLength(120)
  firstName!: string;

  @IsString()
  @MaxLength(120)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  publicName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsOptional()
  @IsInt()
  countryId?: number;

  @IsOptional()
  @IsInt()
  nationalityCountryId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  // --- Slug (auto-généré si absent — voir SpeakersService) ---
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'Le slug ne doit contenir que des minuscules, chiffres et tirets (ex: "jane-doe").',
  })
  @MaxLength(200)
  slug?: string;

  // --- Présentation publique ---
  // `require_tld: false` : accepte les URLs "http://localhost:3000/..."
  // renvoyées par notre propre endpoint d'upload en dev (pas de TLD réel).
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

  @IsOptional()
  @IsEnum(FeeTierPublic)
  feeTierPublic?: FeeTierPublic;

  // --- Visibilité (status géré séparément, voir UpdateSpeakerStatusDto) ---
  @IsOptional()
  @IsBoolean()
  isFeaturedHome?: boolean;

  @IsOptional()
  @IsBoolean()
  isTopRequested?: boolean;

  @IsOptional()
  @IsBoolean()
  showBudget?: boolean;

  @IsOptional()
  @IsBoolean()
  showLocation?: boolean;

  @IsOptional()
  @IsBoolean()
  allowIndexing?: boolean;

  // --- Relations (stratégie de remplacement complet à l'écriture) ---
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
  @ValidateNested()
  @Type(() => PricingInputDto)
  pricing?: PricingInputDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EngagementInputDto)
  engagements?: EngagementInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaInputDto)
  media?: MediaInputDto[];
}
