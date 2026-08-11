import { SpeakerPricing } from '@prisma/client';
import { SpeakerListItemDto } from '../dto/speaker-list-item.dto';
import { SpeakerDetailDto } from '../dto/speaker-detail.dto';
import { SpeakerPricingDto } from '../dto/speaker-pricing.dto';
import { SpeakerListRow, SpeakerDetailRow } from '../speakers.includes';

export function displayNameOf(speaker: {
  publicName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return speaker.publicName ?? `${speaker.firstName} ${speaker.lastName}`;
}

export function toListItemDto(speaker: SpeakerListRow): SpeakerListItemDto {
  return {
    id: speaker.id,
    profilePhotoUrl: speaker.profilePhotoUrl,
    displayName: displayNameOf(speaker),
    professionalTitle: speaker.professionalTitle,
    country: speaker.country,
    primaryPillar: speaker.pillars[0]?.pillar ?? null,
    languages: speaker.languages.map((l) => l.language),
    feeTierPublic: speaker.feeTierPublic,
    status: speaker.status,
    completionScore: speaker.completionScore,
    updatedAt: speaker.updatedAt,
  };
}

export function toPricingDto(
  pricing: SpeakerPricing | null,
): SpeakerPricingDto | null {
  if (!pricing) {
    return null;
  }
  return {
    currency: pricing.currency,
    minFee: pricing.minFee?.toString() ?? null,
    recommendedFee: pricing.recommendedFee?.toString() ?? null,
    feeKeynote: pricing.feeKeynote?.toString() ?? null,
    feePanel: pricing.feePanel?.toString() ?? null,
    feeWebinar: pricing.feeWebinar?.toString() ?? null,
    feeMasterclass: pricing.feeMasterclass?.toString() ?? null,
    feeAdvisory: pricing.feeAdvisory?.toString() ?? null,
    feeOneToOne: pricing.feeOneToOne?.toString() ?? null,
    travelFees: pricing.travelFees,
    negotiationTerms: pricing.negotiationTerms,
    agencyCommission: pricing.agencyCommission?.toString() ?? null,
    internalNotes: pricing.internalNotes,
    updatedAt: pricing.updatedAt,
  };
}

export function toDetailDto(speaker: SpeakerDetailRow): SpeakerDetailDto {
  return {
    id: speaker.id,
    civility: speaker.civility,
    firstName: speaker.firstName,
    lastName: speaker.lastName,
    publicName: speaker.publicName,
    email: speaker.email,
    phone: speaker.phone,
    country: speaker.country,
    nationality: speaker.nationality,
    city: speaker.city,
    timezone: speaker.timezone,

    profilePhotoUrl: speaker.profilePhotoUrl,
    coverPhotoUrl: speaker.coverPhotoUrl,
    professionalTitle: speaker.professionalTitle,
    currentOrganization: speaker.currentOrganization,
    currentPosition: speaker.currentPosition,
    websiteUrl: speaker.websiteUrl,
    linkedinUrl: speaker.linkedinUrl,
    socialLinks: speaker.socialLinks as Record<string, string> | null,

    shortBio: speaker.shortBio,
    fullBio: speaker.fullBio,
    quote: speaker.quote,
    expertiseSummary: speaker.expertiseSummary,
    valueProposition: speaker.valueProposition,
    careerPath: speaker.careerPath,
    keyAchievements: speaker.keyAchievements,
    awards: speaker.awards,

    feeTierPublic: speaker.feeTierPublic,

    status: speaker.status,
    slug: speaker.slug,
    isVisible: speaker.isVisible,
    isFeaturedHome: speaker.isFeaturedHome,
    isTopRequested: speaker.isTopRequested,
    showBudget: speaker.showBudget,
    showLocation: speaker.showLocation,
    allowIndexing: speaker.allowIndexing,
    completionScore: speaker.completionScore,

    publishedAt: speaker.publishedAt,
    createdAt: speaker.createdAt,
    updatedAt: speaker.updatedAt,

    pillars: speaker.pillars.map((p) => ({
      pillar: p.pillar,
      isPrimary: p.isPrimary,
      displayOrder: p.displayOrder,
    })),
    themes: speaker.themes.map((t) => t.theme),
    keywords: speaker.keywords.map((k) => k.keyword),
    formats: speaker.formats.map((f) => f.format),
    languages: speaker.languages.map((l) => ({
      language: l.language,
      proficiency: l.proficiency,
      canPresent: l.canPresent,
      canQa: l.canQa,
      canModerate: l.canModerate,
    })),
    engagements: speaker.engagements,
    media: speaker.media,

    pricing: toPricingDto(speaker.pricing),
  };
}
