// Allow-list FERMÉE des champs qu'un speaker peut proposer via une révision
// (cf. cahier des charges Phase 2 §3). Toute propriété du payload absente
// d'ici est de toute façon rejetée par le ValidationPipe global
// (whitelist + forbidNonWhitelisted) puisque SpeakerRevisionPayloadDto ne
// déclare QUE ces champs — pas de `if` de filtrage à écrire ni à oublier.
export const REVISION_SCALAR_FIELDS = [
  'civility',
  'firstName',
  'lastName',
  'publicName',
  'phone',
  'city',
  'timezone',
  'countryId',
  'profilePhotoUrl',
  'coverPhotoUrl',
  'professionalTitle',
  'currentOrganization',
  'currentPosition',
  'websiteUrl',
  'linkedinUrl',
  'socialLinks',
  'shortBio',
  'fullBio',
  'quote',
  'expertiseSummary',
  'valueProposition',
  'careerPath',
  'keyAchievements',
  'awards',
] as const;

export type RevisionScalarField = (typeof REVISION_SCALAR_FIELDS)[number];

// Libellés lisibles pour l'affichage admin (comparaison avant/après).
export const REVISION_FIELD_LABELS: Record<RevisionScalarField, string> = {
  civility: 'Civilité',
  firstName: 'Prénom',
  lastName: 'Nom',
  publicName: 'Nom public',
  phone: 'Téléphone',
  city: 'Ville',
  timezone: 'Fuseau horaire',
  countryId: 'Pays de résidence',
  profilePhotoUrl: 'Photo de profil',
  coverPhotoUrl: 'Photo de couverture',
  professionalTitle: 'Titre professionnel',
  currentOrganization: 'Organisation actuelle',
  currentPosition: 'Poste actuel',
  websiteUrl: 'Site web',
  linkedinUrl: 'LinkedIn',
  socialLinks: 'Réseaux sociaux',
  shortBio: 'Bio courte',
  fullBio: 'Bio complète',
  quote: 'Citation',
  expertiseSummary: "Résumé d'expertise",
  valueProposition: 'Proposition de valeur',
  careerPath: 'Parcours',
  keyAchievements: 'Réalisations clés',
  awards: 'Distinctions',
};

export const REVISION_RELATION_LABELS = {
  pillars: 'Piliers',
  themeIds: 'Thèmes',
  keywords: 'Mots-clés',
  formatIds: 'Formats',
  languages: 'Langues',
  engagements: 'Signature engagements',
} as const;
