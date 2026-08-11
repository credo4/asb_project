import { ApplicationStatus } from '@prisma/client';

// Même approche que modules/speakers/status-transitions.util.ts et
// modules/booking-requests/booking-request-status-transitions.util.ts — UNE
// SEULE structure de données, jamais des `if` dispersés dans le service.
//
// CONVERTED est délibérément ABSENT de toute liste de transitions ci-dessous
// (y compris depuis APPROVED) : ce n'est PAS un oubli, c'est ce qui garantit
// que ce statut n'est atteignable QUE par RosterApplicationsService#convert
// (qui écrit directement `status: CONVERTED`, en dehors de cette matrice) —
// jamais via PATCH .../status. Le service ajoute un garde-fou explicite en
// plus (voir updateStatus) pour un message d'erreur clair si un appelant
// essaie quand même.
//
// REJECTED/ARCHIVED sont TERMINAUX (tableau vide) : réouverture réservée
// SUPER_ADMIN, journalisée, action séparée qui contourne délibérément cette
// matrice (voir reopen()). CONVERTED est également terminal mais N'EST PAS
// réouvrable (on ne "déconvertit" pas un candidat qui a déjà un compte
// speaker) — voir REOPENABLE_APPLICATION_STATUSES, plus restrictif que
// TERMINAL_APPLICATION_STATUSES.
//
// Hypothèse raisonnable (comme pour BookingStatus) : workflow globalement
// linéaire, avec sortie de secours (REJECTED/ARCHIVED) possible depuis
// quasiment tout état actif, et un aller-retour INFO_REQUESTED <-> UNDER_REVIEW
// pour les échanges avec le candidat. UNDER_REVIEW -> APPROVED directement
// (sans étape entretien) est autorisé : certains profils n'ont pas besoin
// d'entretien avant validation — à ajuster si le process réel de l'équipe diffère.
const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  NEW: [
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.REJECTED,
    ApplicationStatus.ARCHIVED,
  ],
  UNDER_REVIEW: [
    ApplicationStatus.INFO_REQUESTED,
    ApplicationStatus.INTERVIEW_TO_SCHEDULE,
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.ARCHIVED,
  ],
  INFO_REQUESTED: [
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.REJECTED,
    ApplicationStatus.ARCHIVED,
  ],
  INTERVIEW_TO_SCHEDULE: [
    ApplicationStatus.INTERVIEW_DONE,
    ApplicationStatus.REJECTED,
    ApplicationStatus.ARCHIVED,
  ],
  INTERVIEW_DONE: [
    ApplicationStatus.APPROVED,
    ApplicationStatus.INFO_REQUESTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.ARCHIVED,
  ],
  // CONVERTED volontairement absent — voir le commentaire en tête de fichier.
  APPROVED: [ApplicationStatus.ARCHIVED],
  REJECTED: [],
  CONVERTED: [],
  ARCHIVED: [],
};

export const TERMINAL_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.ARCHIVED,
  ApplicationStatus.CONVERTED,
];

// Sous-ensemble de TERMINAL_APPLICATION_STATUSES : CONVERTED est terminal
// mais n'est PAS dans cette liste — jamais réouvrable (voir le commentaire en
// tête de fichier). reopen() valide contre CETTE liste, pas contre
// TERMINAL_APPLICATION_STATUSES.
export const REOPENABLE_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.ARCHIVED,
];

export function isTerminalApplicationStatus(
  status: ApplicationStatus,
): boolean {
  return TERMINAL_APPLICATION_STATUSES.includes(status);
}

export function isApplicationReopenable(status: ApplicationStatus): boolean {
  return REOPENABLE_APPLICATION_STATUSES.includes(status);
}

export function isApplicationStatusTransitionAllowed(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  if (from === to) {
    return true; // no-op toléré (idempotent)
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// Utilisé par le service pour construire un message d'erreur qui liste les
// options valides — pas juste "transition refusée".
export function getAllowedApplicationTransitions(
  from: ApplicationStatus,
): ApplicationStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
