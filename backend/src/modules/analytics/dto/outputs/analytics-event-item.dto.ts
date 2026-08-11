import { AnalyticsEventType } from '@prisma/client';

// Volontairement sans `visitorHash` : même dérivé et non ré-identifiable,
// pas de raison de l'exposer dans une liste d'admin qui ne sert qu'à
// vérifier que les événements arrivent (§B6) — un champ de moins à
// documenter/justifier.
export class AnalyticsEventItemDto {
  id!: number;
  type!: AnalyticsEventType;
  speakerId!: number | null;
  payload!: Record<string, unknown> | null;
  isBot!: boolean;
  referrer!: string | null;
  createdAt!: Date;
}

export class AnalyticsEventListMetaDto {
  total!: number;
  page!: number;
  perPage!: number;
}

export class AnalyticsEventListResponseDto {
  data!: AnalyticsEventItemDto[];
  meta!: AnalyticsEventListMetaDto;
}
