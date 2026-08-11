import {
  FeeTierPublic,
  LanguageProficiency,
  MediaReviewStatus,
  MediaType,
  SpeakerStatus,
} from '@prisma/client';
import { SpeakerPricingDto } from './speaker-pricing.dto';
import {
  CountryRefDto,
  FormatRefDto,
  LanguageRefDto,
  PillarRefDto,
  ThemeRefDto,
} from './outputs/reference.dto';

export class SpeakerPillarDto {
  pillar!: PillarRefDto;
  isPrimary!: boolean;
  displayOrder!: number;
}

export class SpeakerLanguageDto {
  language!: LanguageRefDto;
  proficiency!: LanguageProficiency;
  canPresent!: boolean;
  canQa!: boolean;
  canModerate!: boolean;
}

export class SpeakerEngagementDto {
  id!: number;
  eventName!: string;
  organization!: string | null;
  country!: CountryRefDto | null;
  eventDate!: Date | null;
  dateLabel!: string | null;
  role!: string | null;
  topic!: string | null;
  description!: string | null;
  photoUrl!: string | null;
  videoUrl!: string | null;
  externalUrl!: string | null;
  displayOrder!: number;
}

export class SpeakerMediaDto {
  id!: number;
  type!: MediaType;
  title!: string | null;
  caption!: string | null;
  url!: string;
  thumbnailUrl!: string | null;
  displayOrder!: number;
  status!: MediaReviewStatus;
  reviewedAt!: Date | null;
  reviewedById!: number | null;
  rejectionReason!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

// Projection COMPLÈTE réservée à l'admin (toute cette route est déjà
// restreinte à ADMIN/SUPER_ADMIN — voir SpeakersController). `pricing` utilise
// le DTO dédié SpeakerPricingDto : jamais de champs tarifs à plat ici.
export class SpeakerDetailDto {
  id!: number;
  civility!: string | null;
  firstName!: string;
  lastName!: string;
  publicName!: string | null;
  email!: string | null;
  phone!: string | null;
  country!: CountryRefDto | null;
  nationality!: CountryRefDto | null;
  city!: string | null;
  timezone!: string | null;

  profilePhotoUrl!: string | null;
  coverPhotoUrl!: string | null;
  professionalTitle!: string | null;
  currentOrganization!: string | null;
  currentPosition!: string | null;
  websiteUrl!: string | null;
  linkedinUrl!: string | null;
  socialLinks!: Record<string, string> | null;

  shortBio!: string | null;
  fullBio!: string | null;
  quote!: string | null;
  expertiseSummary!: string | null;
  valueProposition!: string | null;
  careerPath!: string | null;
  keyAchievements!: string | null;
  awards!: string | null;

  feeTierPublic!: FeeTierPublic | null;

  status!: SpeakerStatus;
  slug!: string | null;
  isVisible!: boolean;
  isFeaturedHome!: boolean;
  isTopRequested!: boolean;
  showBudget!: boolean;
  showLocation!: boolean;
  allowIndexing!: boolean;
  completionScore!: number;

  publishedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  pillars!: SpeakerPillarDto[];
  themes!: ThemeRefDto[];
  keywords!: string[];
  formats!: FormatRefDto[];
  languages!: SpeakerLanguageDto[];
  engagements!: SpeakerEngagementDto[];
  media!: SpeakerMediaDto[];

  pricing!: SpeakerPricingDto | null;
}
