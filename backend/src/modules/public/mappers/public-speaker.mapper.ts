import { PublicSpeakerListItemDto } from '../dto/public-speaker-list-item.dto';
import { PublicSpeakerDetailDto } from '../dto/public-speaker-detail.dto';
import {
  PublicSpeakerDetailRow,
  PublicSpeakerListRow,
} from '../public-speaker.select';

// Petite duplication délibérée de la logique de nom d'affichage (déjà
// présente dans le module admin) : voir la note d'isolation dans
// dto/outputs/reference.dto.ts — ce module ne dépend jamais du module admin.
function displayNameOf(speaker: {
  publicName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return speaker.publicName ?? `${speaker.firstName} ${speaker.lastName}`;
}

export function toPublicListItemDto(
  speaker: PublicSpeakerListRow,
): PublicSpeakerListItemDto {
  return {
    slug: speaker.slug as string, // non-null garanti par publicSpeakerWhere() (slug: { not: null })
    displayName: displayNameOf(speaker),
    professionalTitle: speaker.professionalTitle,
    currentOrganization: speaker.currentOrganization,
    profilePhotoUrl: speaker.profilePhotoUrl,
    shortBio: speaker.shortBio,
    // Clé absente (undefined) plutôt que `null` quand le flag est faux :
    // JSON.stringify() omet les clés `undefined`, donc le champ n'apparaît
    // même pas dans la réponse — ce n'est pas juste "vide", il n'existe pas.
    ...(speaker.showLocation
      ? { country: speaker.country, city: speaker.city }
      : {}),
    primaryPillar: speaker.pillars[0]?.pillar ?? null,
    languages: speaker.languages.map((l) => l.language),
    ...(speaker.showBudget && speaker.feeTierPublic
      ? { feeTierPublic: speaker.feeTierPublic }
      : {}),
  };
}

export function toPublicDetailDto(
  speaker: PublicSpeakerDetailRow,
): PublicSpeakerDetailDto {
  return {
    slug: speaker.slug as string,
    displayName: displayNameOf(speaker),
    professionalTitle: speaker.professionalTitle,
    currentOrganization: speaker.currentOrganization,
    currentPosition: speaker.currentPosition,
    profilePhotoUrl: speaker.profilePhotoUrl,
    coverPhotoUrl: speaker.coverPhotoUrl,
    shortBio: speaker.shortBio,
    fullBio: speaker.fullBio,
    quote: speaker.quote,
    expertiseSummary: speaker.expertiseSummary,
    valueProposition: speaker.valueProposition,
    careerPath: speaker.careerPath,
    keyAchievements: speaker.keyAchievements,
    awards: speaker.awards,
    websiteUrl: speaker.websiteUrl,
    linkedinUrl: speaker.linkedinUrl,
    socialLinks: speaker.socialLinks as Record<string, string> | null,
    ...(speaker.showBudget && speaker.feeTierPublic
      ? { feeTierPublic: speaker.feeTierPublic }
      : {}),
    ...(speaker.showLocation
      ? { country: speaker.country, city: speaker.city }
      : {}),
    pillars: speaker.pillars.map((p) => ({
      pillar: p.pillar,
      isPrimary: p.isPrimary,
      displayOrder: p.displayOrder,
    })),
    themes: speaker.themes.map((t) => t.theme),
    formats: speaker.formats.map((f) => f.format),
    languages: speaker.languages.map((l) => ({
      language: l.language,
      proficiency: l.proficiency,
      canPresent: l.canPresent,
      canQa: l.canQa,
      canModerate: l.canModerate,
    })),
    engagements: speaker.engagements,
    // Table unique désormais (consolidation Phase 2, Partie A) : plus de
    // fusion de deux sources ici, le filtre status=APPROVED/deletedAt=null
    // est déjà appliqué au niveau du select (voir public-speaker.select.ts).
    media: speaker.media,
  };
}
