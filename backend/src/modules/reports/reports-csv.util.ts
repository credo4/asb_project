import { toCsv, type CsvColumn } from './csv.util';
import { RankingItemDto } from './dto/outputs/report-common.dto';
import {
  SpeakerMetricDto,
  SpeakersReportDto,
} from './dto/outputs/speakers-report.dto';
import { CommercialReportDto } from './dto/outputs/commercial-report.dto';
import {
  EditorialReportDto,
  ZeroResultSearchDto,
} from './dto/outputs/editorial-report.dto';

// §A6 — "chaque rapport expose une variante ?format=csv" (Partie A) + "un
// bouton d'export CSV sur chaque tableau" (Partie B) : `table` choisit LEQUEL
// des tableaux du rapport exporter (voir QueryReportsDto), avec un choix par
// défaut sensé quand omis — c'est la table la plus "centrale" de chaque
// rapport, listée en premier ci-dessous.

const RANKING_COLUMNS: CsvColumn<RankingItemDto>[] = [
  { header: 'id', value: (r) => r.id },
  { header: 'libelle', value: (r) => r.label },
  { header: 'total', value: (r) => r.count },
];

function rankingCsv(rows: RankingItemDto[]): string {
  return toCsv(rows, RANKING_COLUMNS);
}

// -----------------------------------------------------------------
// Speakers (§14.1)
// -----------------------------------------------------------------
export const SPEAKERS_REPORT_TABLES = [
  'speakers',
  'topFormats',
  'topThemes',
  'topClientCountries',
] as const;
export type SpeakersReportTable = (typeof SPEAKERS_REPORT_TABLES)[number];

export function speakersReportCsv(
  dto: SpeakersReportDto,
  table: string | undefined,
  includeRevenue: boolean,
): string {
  switch (table) {
    case 'topFormats':
      return rankingCsv(dto.topFormats);
    case 'topThemes':
      return rankingCsv(dto.topThemes);
    case 'topClientCountries':
      return rankingCsv(dto.topClientCountries);
    case 'speakers':
    default: {
      const columns: CsvColumn<SpeakerMetricDto>[] = [
        { header: 'speakerId', value: (r) => r.speakerId },
        { header: 'nom', value: (r) => r.displayName },
        { header: 'slug', value: (r) => r.slug },
        { header: 'vuesProfil', value: (r) => r.profileViews },
        { header: 'demandes', value: (r) => r.requestsCount },
        { header: 'missions', value: (r) => r.missionsCount },
        {
          header: 'sollicitationsReponduesTotal',
          value: (r) => r.availabilityResponsesTotal,
        },
        {
          header: 'tauxAcceptationPourcent',
          value: (r) =>
            r.availabilityAcceptanceRate === null
              ? ''
              : r.availabilityAcceptanceRate.toFixed(1),
        },
      ];
      if (includeRevenue) {
        columns.push({
          header: 'revenusRealises',
          value: (r) => r.realizedRevenue ?? '',
        });
      }
      return toCsv(dto.speakers, columns);
    }
  }
}

// -----------------------------------------------------------------
// Commercial (§14.2)
// -----------------------------------------------------------------
export const COMMERCIAL_REPORT_TABLES = [
  'requestsSeries',
  'requestsByServiceType',
  'topClientOrganizations',
  'topBookedSpeakers',
] as const;
export type CommercialReportTable = (typeof COMMERCIAL_REPORT_TABLES)[number];

export function commercialReportCsv(
  dto: CommercialReportDto,
  table: string | undefined,
): string {
  switch (table) {
    case 'requestsByServiceType':
      return rankingCsv(dto.requestsByServiceType);
    case 'topClientOrganizations':
      return rankingCsv(dto.topClientOrganizations);
    case 'topBookedSpeakers':
      return rankingCsv(dto.topBookedSpeakers);
    case 'requestsSeries':
    default:
      return toCsv(dto.requestsSeries, [
        { header: 'date', value: (r) => r.date },
        { header: 'demandes', value: (r) => r.count },
      ]);
  }
}

// -----------------------------------------------------------------
// Éditorial (§14.3)
// -----------------------------------------------------------------
export const EDITORIAL_REPORT_TABLES = [
  'topViewedProfiles',
  'topFilters',
  'topZeroResultQueries',
  'curatedListViews',
] as const;
export type EditorialReportTable = (typeof EDITORIAL_REPORT_TABLES)[number];

export function editorialReportCsv(
  dto: EditorialReportDto,
  table: string | undefined,
): string {
  switch (table) {
    case 'topFilters':
      return rankingCsv(dto.topFilters);
    case 'curatedListViews':
      return rankingCsv(dto.curatedListViews);
    case 'topZeroResultQueries': {
      const columns: CsvColumn<ZeroResultSearchDto>[] = [
        { header: 'recherche', value: (r) => r.query ?? '(filtres seuls)' },
        { header: 'occurrences', value: (r) => r.count },
      ];
      return toCsv(dto.topZeroResultQueries, columns);
    }
    case 'topViewedProfiles':
    default:
      return rankingCsv(dto.topViewedProfiles);
  }
}
