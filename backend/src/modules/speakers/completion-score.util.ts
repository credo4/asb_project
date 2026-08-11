import { SpeakerDetailRow } from './speakers.includes';

// Liste pondérée (total = 100). Isolée ici pour pouvoir ajuster facilement
// les poids sans toucher au reste du service. `isComplete` reçoit la fiche
// speaker AVEC ses relations (voir SPEAKER_DETAIL_INCLUDE).
interface CompletionCriterion {
  label: string;
  weight: number;
  isComplete: (speaker: SpeakerDetailRow) => boolean;
}

const isNonEmpty = (value: string | null | undefined): boolean =>
  !!value && value.trim().length > 0;

const CRITERIA: CompletionCriterion[] = [
  {
    label: 'nom (prénom + nom)',
    weight: 5,
    isComplete: (s) => isNonEmpty(s.firstName) && isNonEmpty(s.lastName),
  },
  {
    label: 'nom public',
    weight: 5,
    isComplete: (s) => isNonEmpty(s.publicName),
  },
  {
    label: 'photo de profil',
    weight: 15,
    isComplete: (s) => isNonEmpty(s.profilePhotoUrl),
  },
  {
    label: 'photo de couverture',
    weight: 5,
    isComplete: (s) => isNonEmpty(s.coverPhotoUrl),
  },
  {
    label: 'titre professionnel',
    weight: 10,
    isComplete: (s) => isNonEmpty(s.professionalTitle),
  },
  {
    label: 'bio courte',
    weight: 15,
    isComplete: (s) => isNonEmpty(s.shortBio),
  },
  {
    label: 'bio complète',
    weight: 10,
    isComplete: (s) => isNonEmpty(s.fullBio),
  },
  {
    label: 'au moins un pilier',
    weight: 10,
    isComplete: (s) => s.pillars.length > 0,
  },
  {
    label: 'au moins un thème',
    weight: 5,
    isComplete: (s) => s.themes.length > 0,
  },
  {
    label: 'au moins un format',
    weight: 5,
    isComplete: (s) => s.formats.length > 0,
  },
  {
    label: 'au moins une langue',
    weight: 5,
    isComplete: (s) => s.languages.length > 0,
  },
  {
    label: 'au moins un signature engagement',
    weight: 5,
    isComplete: (s) => s.engagements.length > 0,
  },
  {
    label: 'niveau tarifaire indicatif',
    weight: 2,
    isComplete: (s) => s.feeTierPublic !== null,
  },
  {
    label: 'pays de résidence',
    weight: 3,
    isComplete: (s) => s.countryId !== null,
  },
];

export function calculateCompletionScore(speaker: SpeakerDetailRow): number {
  const total = CRITERIA.reduce(
    (score, criterion) =>
      criterion.isComplete(speaker) ? score + criterion.weight : score,
    0,
  );
  return Math.max(0, Math.min(100, total));
}
