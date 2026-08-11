import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, MaxLength } from 'class-validator';
import { PUBLIC_ANALYTICS_EVENT_TYPES } from '../analytics.constants';
import type { PublicAnalyticsEventType } from '../analytics.constants';

// Surface d'écriture PUBLIQUE (§B3) — traitée avec la même méfiance que les
// formulaires de la Phase 1d : allow-list stricte des types (voir
// PUBLIC_ANALYTICS_EVENT_TYPES, PROFILE_VIEW/SEARCH exclus car déjà captés
// côté serveur), AUCUN champ libre non borné. Pas de `payload` générique ici
// : seulement les deux champs scalaires dont ces 3 types ont besoin, chacun
// validé/borné individuellement — plus sûr qu'un objet JSON arbitraire dont
// il faudrait filtrer les clés après coup.
export class CreateAnalyticsEventDto {
  @IsIn(PUBLIC_ANALYTICS_EVENT_TYPES)
  type!: PublicAnalyticsEventType;

  // Pertinent pour CHECK_AVAILABILITY_CLICK.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  speakerId?: number;

  // Pertinent pour CURATED_LIST_VIEW/TOPIC_VIEW (slug de la liste éditoriale
  // ou du topic consulté) — format restreint, pas de texte libre.
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug ne doit contenir que des minuscules, chiffres et tirets.',
  })
  @MaxLength(120)
  slug?: string;
}
