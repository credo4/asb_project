import { IsIn, IsOptional, Matches, MaxLength } from 'class-validator';
import { PUBLIC_ANALYTICS_EVENT_TYPES } from '../analytics.constants';
import type { PublicAnalyticsEventType } from '../analytics.constants';

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_MESSAGE = 'ne doit contenir que des minuscules, chiffres et tirets.';

// Surface d'écriture PUBLIQUE (§B3) — traitée avec la même méfiance que les
// formulaires de la Phase 1d : allow-list stricte des types (voir
// PUBLIC_ANALYTICS_EVENT_TYPES, PROFILE_VIEW/SEARCH exclus car déjà captés
// côté serveur), AUCUN champ libre non borné.
//
// Consolidation, Partie C — les IDENTIFIANTS INTERNES (`speakerId` brut) ne
// sont JAMAIS exposés publiquement (décision Phase 0 : les URLs publiques
// passent par le slug — voir CLAUDE.md §5). L'ancien champ `speakerId`
// direct était donc inexploitable par un vrai site public, qui ne connaît
// QUE des slugs. `speakerSlug`/`curatedListSlug` sont résolus côté serveur
// en identifiants internes AVANT tout enregistrement (voir
// AnalyticsService#resolveSpeakerIdBySlug / resolveCuratedListIdBySlug) —
// un slug inconnu n'est pas une erreur bloquante, l'événement est
// simplement ignoré (compté comme rejeté dans les logs).
export class CreateAnalyticsEventDto {
  @IsIn(PUBLIC_ANALYTICS_EVENT_TYPES)
  type!: PublicAnalyticsEventType;

  // Pertinent pour CHECK_AVAILABILITY_CLICK.
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: `speakerSlug ${SLUG_MESSAGE}` })
  @MaxLength(220)
  speakerSlug?: string;

  // Pertinent pour CURATED_LIST_VIEW.
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: `curatedListSlug ${SLUG_MESSAGE}` })
  @MaxLength(220)
  curatedListSlug?: string;

  // Pertinent pour TOPIC_VIEW UNIQUEMENT désormais (les topics n'ont pas
  // d'entité backing — hors périmètre de cette étape, cf. prompt) : reste un
  // slug opaque, stocké tel quel dans `payload`, jamais résolu en id (il n'y
  // a rien à résoudre).
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: `slug ${SLUG_MESSAGE}` })
  @MaxLength(120)
  slug?: string;
}
