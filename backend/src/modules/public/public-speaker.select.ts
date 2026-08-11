import { Prisma } from '@prisma/client';
import { PUBLIC_PILLARS_PER_SPEAKER } from './public-speaker.constants';

// `select` (pas `include`) : on énumère explicitement CHAQUE champ renvoyé
// par la base, à tous les niveaux. Un champ qui n'est pas listé ici n'est
// même pas récupéré depuis MySQL — contrairement à un `include`/`SELECT *`
// suivi d'un filtrage en mémoire, où un oubli dans le mapper laisserait la
// donnée privée transiter par le process Node (visible dans un log, un
// débogueur, un `console.log(speaker)` malheureux...) avant d'être filtrée.
// Avec `select`, l'information n'existe tout simplement nulle part après
// la requête : rien à oublier de retirer.

export const PUBLIC_SPEAKER_LIST_SELECT = {
  slug: true,
  publicName: true,
  firstName: true,
  lastName: true,
  professionalTitle: true,
  currentOrganization: true,
  profilePhotoUrl: true,
  shortBio: true,
  feeTierPublic: true,
  showBudget: true, // utilisé pour décider d'inclure feeTierPublic ; jamais recopié tel quel dans le DTO
  showLocation: true, // idem pour country/city
  city: true,
  country: { select: { id: true, name: true, iso2: true } },
  pillars: {
    where: { isPrimary: true },
    take: 1,
    select: { pillar: { select: { id: true, name: true, slug: true } } },
  },
  languages: {
    select: { language: { select: { id: true, name: true, code: true } } },
  },
} satisfies Prisma.SpeakerSelect;

export type PublicSpeakerListRow = Prisma.SpeakerGetPayload<{
  select: typeof PUBLIC_SPEAKER_LIST_SELECT;
}>;

export const PUBLIC_SPEAKER_DETAIL_SELECT = {
  // Sélectionné pour un usage STRICTEMENT interne (lier un PROFILE_VIEW au
  // bon speaker, Phase 3 §3a) — jamais copié dans PublicSpeakerDetailDto par
  // le mapper (voir toPublicDetailDto) : l'invariant "pas d'id brut côté
  // public" reste garanti au niveau de la SORTIE, pas de la lecture DB.
  id: true,
  slug: true,
  publicName: true,
  firstName: true,
  lastName: true,
  professionalTitle: true,
  currentOrganization: true,
  currentPosition: true,
  profilePhotoUrl: true,
  coverPhotoUrl: true,
  shortBio: true,
  fullBio: true,
  quote: true,
  expertiseSummary: true,
  valueProposition: true,
  careerPath: true,
  keyAchievements: true,
  awards: true,
  websiteUrl: true,
  linkedinUrl: true,
  socialLinks: true,
  feeTierPublic: true,
  showBudget: true,
  showLocation: true,
  city: true,
  country: { select: { id: true, name: true, iso2: true } },
  pillars: {
    orderBy: { displayOrder: 'asc' },
    take: PUBLIC_PILLARS_PER_SPEAKER,
    select: {
      isPrimary: true,
      displayOrder: true,
      pillar: { select: { id: true, name: true, slug: true } },
    },
  },
  themes: {
    select: {
      theme: { select: { id: true, name: true, slug: true, pillarId: true } },
    },
  },
  formats: {
    select: { format: { select: { id: true, name: true, slug: true } } },
  },
  languages: {
    select: {
      proficiency: true,
      canPresent: true,
      canQa: true,
      canModerate: true,
      language: { select: { id: true, name: true, code: true } },
    },
  },
  engagements: {
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      eventName: true,
      organization: true,
      eventDate: true,
      dateLabel: true,
      role: true,
      topic: true,
      description: true,
      photoUrl: true,
      videoUrl: true,
      externalUrl: true,
      displayOrder: true,
      country: { select: { id: true, name: true, iso2: true } },
    },
  },
  // `where: { status: APPROVED, deletedAt: null }` DANS le select : un média
  // PENDING_REVIEW/REJECTED ou supprimé n'est jamais chargé depuis la base,
  // pas seulement caché à l'affichage (consolidation Phase 2, Partie A —
  // table unique, un seul chemin de lecture vers le public).
  media: {
    where: { status: 'APPROVED', deletedAt: null },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      type: true,
      title: true,
      url: true,
      displayOrder: true,
    },
  },
} satisfies Prisma.SpeakerSelect;

export type PublicSpeakerDetailRow = Prisma.SpeakerGetPayload<{
  select: typeof PUBLIC_SPEAKER_DETAIL_SELECT;
}>;
