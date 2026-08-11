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

// La création du User + Speaker + envoi de l'email d'invitation se fait DANS
// la même transaction Prisma que la conversion (§4.1 : "si une seule étape
// échoue, RIEN n'est écrit", y compris l'email — voir RosterApplicationsService#convert).
// Un timeout de transaction plus généreux que le défaut (5s) réduit le risque
// qu'un envoi SMTP un peu lent fasse expirer la transaction en usage réel ;
// en test, MailService est mocké (résolution immédiate), donc sans incidence.
export const CONVERSION_TRANSACTION_TIMEOUT_MS = 15_000;
