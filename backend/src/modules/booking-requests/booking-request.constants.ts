import { ServiceType } from '@prisma/client';

// Groupes de services partagés par la validation conditionnelle du DTO ET
// par le service (calcul du SLA). Centralisés ici pour n'avoir qu'un seul
// endroit à ajuster si le périmètre d'un formulaire change.

// organization est requis pour les 5 services (cf. cahier des charges §4) —
// pas de groupe dédié, c'est juste un champ obligatoire sur le DTO.

// Champs "événement" (eventName/eventDate/eventLocation/eventFormat/
// primaryTopics/goals) : attendus pour tout sauf ONE_TO_ONE.
export const EVENT_DETAIL_SERVICE_TYPES: ServiceType[] = [
  ServiceType.CONFERENCE,
  ServiceType.MASTERCLASS,
  ServiceType.WEBINAR,
  ServiceType.ADVISORY,
];

// audienceSize : uniquement pour les 3 formats "grand public" (pas ADVISORY,
// une consultation stratégique n'a pas de "taille d'audience").
export const AUDIENCE_SIZE_SERVICE_TYPES: ServiceType[] = [
  ServiceType.CONFERENCE,
  ServiceType.MASTERCLASS,
  ServiceType.WEBINAR,
];

export const ONE_TO_ONE_SERVICE_TYPES: ServiceType[] = [ServiceType.ONE_TO_ONE];

// Valeurs autorisées d'eventFormat, PAR service. Hypothèse raisonnable en
// l'absence de liste imposée par le cahier des charges — à ajuster librement
// une fois les formulaires réels du site public connus (comme pour la liste
// des pays internationaux dans prisma/seed.ts).
export const EVENT_FORMATS_BY_SERVICE: Partial<Record<ServiceType, string[]>> =
  {
    [ServiceType.CONFERENCE]: [
      'In-Person',
      'Virtual',
      'Hybrid',
      'Keynote',
      'Panel',
      'Fireside Chat',
    ],
    [ServiceType.MASTERCLASS]: ['In-Person', 'Virtual', 'Hybrid'],
    [ServiceType.WEBINAR]: ['Virtual'],
    [ServiceType.ADVISORY]: [
      'One-off Session',
      'Ongoing Retainer',
      'Strategy Sprint',
    ],
  };

// SLA de première réponse, en jours OUVRÉS — cf. cahier des charges §6.
export const RESPONSE_SLA_BUSINESS_DAYS: Record<ServiceType, number> = {
  [ServiceType.CONFERENCE]: 2,
  [ServiceType.MASTERCLASS]: 5,
  [ServiceType.WEBINAR]: 5,
  [ServiceType.ADVISORY]: 5,
  [ServiceType.ONE_TO_ONE]: 5,
};

// -----------------------------------------------------------------------
// Consentement (Phase 3b, §3) — TRANSITION DOUCE.
// -----------------------------------------------------------------------
// Le site public ne renvoie pas encore consentGivenAt/consentVersion :
// tant que ce drapeau vaut `false`, ces champs restent optionnels dans
// CreateBookingRequestDto et une demande sans consentement est acceptée
// (avec un simple avertissement loggé). À basculer à `true` UNIQUEMENT une
// fois le nouveau formulaire du site public déployé et confirmé envoyer ces
// deux champs sur CHAQUE soumission — pas avant, sous peine de rejeter des
// demandes légitimes en 400 du jour au lendemain.
export const REQUIRE_CONSENT = false;

// Identifiant de la version de politique actuellement en vigueur, utilisé
// pour la création manuelle (source = MANUAL_ENTRY, où l'admin peut cocher
// "consentement donné" sans que le prospect ait rempli le formulaire public).
export const CURRENT_CONSENT_VERSION = 'v1';
