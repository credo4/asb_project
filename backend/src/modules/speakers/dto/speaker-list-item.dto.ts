import { FeeTierPublic, SpeakerStatus } from '@prisma/client';
import {
  CountryRefDto,
  LanguageRefDto,
  PillarRefDto,
} from './outputs/reference.dto';

// Projection LÉGÈRE pour la liste : ni les relations complètes, ni les
// tarifs (voir SpeakerPricingDto, jamais référencé ici).
export class SpeakerListItemDto {
  id!: number;
  profilePhotoUrl!: string | null;
  displayName!: string;
  professionalTitle!: string | null;
  country!: CountryRefDto | null;
  primaryPillar!: PillarRefDto | null;
  languages!: LanguageRefDto[];
  feeTierPublic!: FeeTierPublic | null;
  status!: SpeakerStatus;
  completionScore!: number;
  updatedAt!: Date;
}

export class SpeakerListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class SpeakerListResponseDto {
  data!: SpeakerListItemDto[];
  meta!: SpeakerListMetaDto;
}
