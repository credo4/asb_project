import {
  ReportMetaDto,
  ComparedValueDto,
  RankingItemDto,
} from './report-common.dto';

export class RequestsSeriesPointDto {
  date!: string; // "YYYY-MM-DD", dans le fuseau du rapport (voir meta.timezone)
  count!: number;
}

export class RevenueBreakdownDto {
  // §A3 — deux chiffres distincts, jamais confondus : RÉALISÉ (missions
  // livrées ou terminées) vs PRÉVISIONNEL (confirmées, pas encore livrées).
  realized!: ComparedValueDto;
  forecast!: ComparedValueDto;
}

export class CommercialReportDto {
  meta!: ReportMetaDto;
  requestsSeries!: RequestsSeriesPointDto[];
  requestsByServiceType!: RankingItemDto[];
  // §A3 — dénominateur explicite : voir CONVERSION_RATE_DEFINITION.
  conversionRateDefinition!: string;
  conversionRate!: ComparedValueDto;
  averageFirstResponseHours!: ComparedValueDto;
  // Remplace "budget moyen" (estimatedBudget est un champ TEXTE LIBRE côté
  // demande — jamais moyenné, voir le rapport de session) : montant client
  // moyen des MISSIONS de la période, une donnée réellement numérique.
  averageMissionClientAmount!: ComparedValueDto;
  cancelledRequests!: ComparedValueDto;
  topClientOrganizations!: RankingItemDto[];
  topBookedSpeakers!: RankingItemDto[];
  // §A4 — SUPER_ADMIN uniquement, clés absentes du JSON sinon.
  revenue?: RevenueBreakdownDto;
  commission?: RevenueBreakdownDto;
}
