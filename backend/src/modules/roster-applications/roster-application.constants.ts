// Version des conditions de collaboration actuellement en vigueur, acceptée
// obligatoirement à la définition du mot de passe (voir InvitationsService,
// User.acceptedTermsAt/acceptedTermsVersion). Même pattern que
// CURRENT_CONSENT_VERSION dans booking-request.constants.ts.
export const CURRENT_TERMS_VERSION = 'v1';

// Politique de mot de passe — identique à ResetPasswordDto (Phase 0).
export const PASSWORD_MIN_LENGTH = 8;

// Durée de vie par défaut du token d'invitation (§4.4) — configurable via
// INVITATION_TOKEN_TTL_DAYS, jamais en dur ailleurs dans le service.
export const DEFAULT_INVITATION_TOKEN_TTL_DAYS = 14;

// La transaction de conversion (création User + Speaker + passage en
// CONVERTED + persistance du token d'invitation — voir
// RosterApplicationsService#convert) ne contient AUCUN appel réseau : l'envoi
// de l'email d'invitation se fait délibérément APRÈS le commit (§4.2 —
// aucun envoi d'email ne doit jamais avoir lieu DANS une transaction Prisma,
// règle valable pour tout le projet, pas seulement ici). Le timeout par
// défaut (5s) suffirait donc largement en local, mais reste généreux ici
// pour absorber la latence d'une base de production distante — leçon tirée
// concrètement d'un timeout de transaction (5s, trop court) rencontré en
// conditions réelles sur `seed:demo-speakers` contre la base Hostinger.
export const CONVERSION_TRANSACTION_TIMEOUT_MS = 15_000;
