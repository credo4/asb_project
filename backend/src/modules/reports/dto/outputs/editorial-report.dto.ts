import {
  ReportMetaDto,
  ComparedValueDto,
  RankingItemDto,
} from './report-common.dto';

export class ZeroResultSearchDto {
  // Terme de recherche libre (`q`) — null si la recherche ne portait que sur
  // des filtres (pillar/pays/langue...) sans texte libre.
  query!: string | null;
  count!: number;
}

export class EditorialReportDto {
  meta!: ReportMetaDto;
  // Vues de profil DÉDOUBLONNÉES (§A1, fenêtre de 30 min) — jamais un
  // simple COUNT(*) brut sur analytics_events.
  topViewedProfiles!: RankingItemDto[];
  searchesCount!: ComparedValueDto;
  // Un filtre = une CLÉ de recherche effectivement renseignée
  // (pillar/theme/country/language/format/feeTier/q) — pas une valeur
  // précise, pour rester un classement lisible plutôt qu'une longue traîne.
  topFilters!: RankingItemDto[];
  // §14.3 — "le plus actionnable de tous : ce que les clients cherchent et
  // que le roster n'a pas".
  zeroResultSearchesCount!: ComparedValueDto;
  topZeroResultQueries!: ZeroResultSearchDto[];
  checkAvailabilityClicks!: ComparedValueDto;
  curatedListViews!: RankingItemDto[];
}
