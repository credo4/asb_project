import { Injectable } from '@nestjs/common';
import { AnalyticsEventType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { compare, resolvePeriods, type ReportPeriod } from './period.util';
import {
  ACCEPTANCE_RESPONSE_STATUSES,
  CONVERSION_RATE_DEFINITION,
  FORECAST_MISSION_STATUSES,
  REALIZED_MISSION_STATUSES,
  REPORTS_TIMEZONE,
  VIEW_DEDUP_WINDOW_MINUTES,
} from './reports.constants';
import {
  QueryReportsDto,
  QuerySpeakersReportDto,
} from './dto/query-reports.dto';
import { ReportMetaDto, RankingItemDto } from './dto/outputs/report-common.dto';
import {
  SpeakerMetricDto,
  SpeakersReportDto,
} from './dto/outputs/speakers-report.dto';
import {
  CommercialReportDto,
  RequestsSeriesPointDto,
} from './dto/outputs/commercial-report.dto';
import {
  EditorialReportDto,
  ZeroResultSearchDto,
} from './dto/outputs/editorial-report.dto';

interface SearchPayload {
  filters?: {
    q?: string | null;
    pillar?: unknown;
    theme?: unknown;
    country?: unknown;
    language?: unknown;
    format?: unknown;
    feeTier?: unknown;
  };
  resultCount?: number;
}

const FILTER_KEYS = [
  'q',
  'pillar',
  'theme',
  'country',
  'language',
  'format',
  'feeTier',
] as const;

function speakerDisplayName(row: {
  publicName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return row.publicName ?? `${row.firstName} ${row.lastName}`;
}

// §A1 — TOUT ce module agrège À LA VOLÉE (voir reports.constants.ts pour le
// seuil de revue). Beaucoup de requêtes ci-dessous passent par `$queryRaw`
// plutôt que le query builder Prisma : les GROUP BY multi-tables, la
// fonction fenêtrée de dédoublonnage des vues et les séries temporelles par
// jour ne s'expriment pas proprement avec `groupBy` (pas de jointure). Tous
// les paramètres utilisateur (dates, includeBots) passent par le template
// taggé `Prisma.sql`/`$queryRaw`, jamais une concaténation de chaîne —
// paramétrées comme n'importe quelle requête Prisma normale.
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // -----------------------------------------------------------------
  // §14.1 — Rapport Speakers
  // -----------------------------------------------------------------
  async getSpeakersReport(
    query: QuerySpeakersReportDto,
    actorRole: Role,
  ): Promise<SpeakersReportDto> {
    const { current, previous } = resolvePeriods(query.from, query.to);
    const includeBots = query.includeBots ?? false;
    // Pas de comparaison période/période sur la TABLE par speaker ci-dessous
    // (voir DTO) — `previous` sert uniquement aux 4 tuiles globales
    // (totalProfileViews/totalRequests/totalMissions/acceptanceRate).

    const [
      views,
      requests,
      missions,
      availability,
      revenue,
      totalsCurrent,
      totalsPrevious,
    ] = await Promise.all([
      this.dedupedProfileViewsBySpeaker(current, includeBots),
      this.requestsCountBySpeaker(current),
      this.missionsCountBySpeaker(current),
      this.availabilityAcceptanceBySpeaker(current),
      actorRole === Role.SUPER_ADMIN
        ? this.realizedRevenueBySpeaker(current)
        : Promise.resolve(new Map<number, number>()),
      this.speakersTotals(current, includeBots),
      this.speakersTotals(previous, includeBots),
    ]);

    const speakerIds = new Set<number>([
      ...views.keys(),
      ...requests.keys(),
      ...missions.keys(),
      ...availability.keys(),
      ...revenue.keys(),
    ]);

    const speakerRows = speakerIds.size
      ? await this.prisma.speaker.findMany({
          where: { id: { in: [...speakerIds] } },
          select: {
            id: true,
            publicName: true,
            firstName: true,
            lastName: true,
            slug: true,
          },
        })
      : [];
    const speakerById = new Map(speakerRows.map((s) => [s.id, s]));

    const allRows: SpeakerMetricDto[] = [...speakerIds]
      .map((id) => {
        const speaker = speakerById.get(id);
        const avail = availability.get(id);
        const row: SpeakerMetricDto = {
          speakerId: id,
          displayName: speaker ? speakerDisplayName(speaker) : `#${id}`,
          slug: speaker?.slug ?? null,
          profileViews: views.get(id) ?? 0,
          requestsCount: requests.get(id) ?? 0,
          missionsCount: missions.get(id) ?? 0,
          availabilityResponsesTotal: avail?.total ?? 0,
          availabilityAcceptanceRate:
            avail && avail.total > 0
              ? (avail.accepted / avail.total) * 100
              : null,
        };
        if (actorRole === Role.SUPER_ADMIN) {
          row.realizedRevenue = revenue.get(id) ?? 0;
        }
        return row;
      })
      // Activité totale décroissante — le plus actif d'abord.
      .sort(
        (a, b) =>
          b.profileViews +
          b.requestsCount +
          b.missionsCount -
          (a.profileViews + a.requestsCount + a.missionsCount),
      );

    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const paged = allRows.slice(
      (page - 1) * perPage,
      (page - 1) * perPage + perPage,
    );

    const [topFormats, topThemes, topClientCountries] = await Promise.all([
      this.topFormatsRequested(current),
      this.topThemesRequested(current),
      this.topClientCountries(current),
    ]);

    return {
      meta: this.buildMeta(current, previous, includeBots),
      totalProfileViews: compare(
        totalsCurrent.profileViews,
        totalsPrevious.profileViews,
      ),
      totalRequests: compare(totalsCurrent.requests, totalsPrevious.requests),
      totalMissions: compare(totalsCurrent.missions, totalsPrevious.missions),
      acceptanceRate: compare(
        totalsCurrent.responded > 0
          ? (totalsCurrent.accepted / totalsCurrent.responded) * 100
          : 0,
        totalsPrevious.responded > 0
          ? (totalsPrevious.accepted / totalsPrevious.responded) * 100
          : 0,
      ),
      // `useApiList` côté front (Partie B) — voir CLAUDE.md.
      speakers: paged,
      speakersMeta: { total: allRows.length, page, perPage },
      topFormats,
      topThemes,
      topClientCountries,
    };
  }

  // Totaux GLOBAUX de la période (tous les speakers ayant une activité, pas
  // seulement la page affichée) — alimente les 4 tuiles du rapport Speakers
  // (voir SpeakersReportDto). Requêtes indépendantes des maps par-speaker
  // ci-dessus (légère redondance assumée) : plus simple et plus sûr que de
  // sommer des Maps déjà calculées pour LA SEULE période courante, alors
  // qu'il faut aussi ces totaux pour la période PRÉCÉDENTE.
  private async speakersTotals(
    period: ReportPeriod,
    includeBots: boolean,
  ): Promise<{
    profileViews: number;
    requests: number;
    missions: number;
    accepted: number;
    responded: number;
  }> {
    const [viewRows, requests, missions, availability] = await Promise.all([
      this.prisma.$queryRaw<{ views: bigint }[]>`
        SELECT COUNT(*) AS views FROM (
          SELECT speaker_id, created_at,
            LAG(created_at) OVER (PARTITION BY visitor_hash, speaker_id ORDER BY created_at) AS prev_created_at
          FROM analytics_events
          WHERE type = 'PROFILE_VIEW'
            AND speaker_id IS NOT NULL
            AND (${includeBots} OR is_bot = 0)
        ) t
        WHERE created_at >= ${period.from} AND created_at < ${period.to}
          AND (prev_created_at IS NULL OR created_at > DATE_ADD(prev_created_at, INTERVAL ${VIEW_DEDUP_WINDOW_MINUTES} MINUTE))
      `,
      this.prisma.bookingRequestSpeaker.count({
        where: {
          deletedAt: null,
          addedAt: { gte: period.from, lt: period.to },
        },
      }),
      this.prisma.mission.count({
        where: {
          deletedAt: null,
          eventDate: { gte: period.from, lt: period.to },
        },
      }),
      this.prisma.availabilityRequest.groupBy({
        by: ['responseStatus'],
        where: {
          responseStatus: { not: null },
          respondedAt: { gte: period.from, lt: period.to },
        },
        _count: { _all: true },
      }),
    ]);

    let accepted = 0;
    let responded = 0;
    for (const row of availability) {
      responded += row._count._all;
      if (
        row.responseStatus &&
        (ACCEPTANCE_RESPONSE_STATUSES as readonly string[]).includes(
          row.responseStatus,
        )
      ) {
        accepted += row._count._all;
      }
    }

    return {
      profileViews: Number(viewRows[0]?.views ?? 0),
      requests,
      missions,
      accepted,
      responded,
    };
  }

  // -----------------------------------------------------------------
  // §14.2 — Rapport Commercial
  // -----------------------------------------------------------------
  async getCommercialReport(
    query: QueryReportsDto,
    actorRole: Role,
  ): Promise<CommercialReportDto> {
    const { current, previous } = resolvePeriods(query.from, query.to);
    const includeBots = query.includeBots ?? false;
    void includeBots; // sans objet ici : ce rapport ne touche pas analytics_events

    const [
      requestsSeries,
      requestsByServiceType,
      conversionCurrent,
      conversionPrevious,
      firstResponseCurrent,
      firstResponsePrevious,
      avgAmountCurrent,
      avgAmountPrevious,
      cancelledCurrent,
      cancelledPrevious,
      topClientOrganizations,
      topBookedSpeakers,
    ] = await Promise.all([
      this.requestsSeries(current),
      this.requestsByServiceType(current),
      this.conversionRate(current),
      this.conversionRate(previous),
      this.averageFirstResponseHours(current),
      this.averageFirstResponseHours(previous),
      this.averageMissionClientAmount(current),
      this.averageMissionClientAmount(previous),
      this.cancelledRequestsCount(current),
      this.cancelledRequestsCount(previous),
      this.topClientOrganizations(current),
      this.topBookedSpeakers(current),
    ]);

    const dto: CommercialReportDto = {
      meta: this.buildMeta(current, previous, false),
      requestsSeries,
      requestsByServiceType,
      conversionRateDefinition: CONVERSION_RATE_DEFINITION,
      conversionRate: compare(conversionCurrent, conversionPrevious),
      averageFirstResponseHours: compare(
        firstResponseCurrent,
        firstResponsePrevious,
      ),
      averageMissionClientAmount: compare(avgAmountCurrent, avgAmountPrevious),
      cancelledRequests: compare(cancelledCurrent, cancelledPrevious),
      topClientOrganizations,
      topBookedSpeakers,
    };

    if (actorRole === Role.SUPER_ADMIN) {
      const [rCurrent, rPrevious] = await Promise.all([
        this.revenueAndCommission(current),
        this.revenueAndCommission(previous),
      ]);
      dto.revenue = {
        realized: compare(rCurrent.realizedRevenue, rPrevious.realizedRevenue),
        forecast: compare(rCurrent.forecastRevenue, rPrevious.forecastRevenue),
      };
      dto.commission = {
        realized: compare(
          rCurrent.realizedCommission,
          rPrevious.realizedCommission,
        ),
        forecast: compare(
          rCurrent.forecastCommission,
          rPrevious.forecastCommission,
        ),
      };
    }

    return dto;
  }

  // -----------------------------------------------------------------
  // §14.3 — Rapport Éditorial
  // -----------------------------------------------------------------
  async getEditorialReport(
    query: QueryReportsDto,
  ): Promise<EditorialReportDto> {
    const { current, previous } = resolvePeriods(query.from, query.to);
    const includeBots = query.includeBots ?? false;

    const [
      topViewedProfiles,
      searchRowsCurrent,
      searchRowsPrevious,
      checkClicksCurrent,
      checkClicksPrevious,
      curatedListViews,
    ] = await Promise.all([
      this.topViewedProfiles(current, includeBots),
      this.searchPayloads(current, includeBots),
      this.searchPayloads(previous, includeBots),
      this.countByType(current, 'CHECK_AVAILABILITY_CLICK', includeBots),
      this.countByType(previous, 'CHECK_AVAILABILITY_CLICK', includeBots),
      this.curatedListViews(current, includeBots),
    ]);

    const topFilters = this.aggregateTopFilters(searchRowsCurrent);
    const zeroResultCurrent = searchRowsCurrent.filter(
      (p) => (p.resultCount ?? 0) === 0,
    );
    const zeroResultPrevious = searchRowsPrevious.filter(
      (p) => (p.resultCount ?? 0) === 0,
    );
    const topZeroResultQueries =
      this.aggregateZeroResultQueries(zeroResultCurrent);

    return {
      meta: this.buildMeta(current, previous, includeBots),
      topViewedProfiles,
      searchesCount: compare(
        searchRowsCurrent.length,
        searchRowsPrevious.length,
      ),
      topFilters,
      zeroResultSearchesCount: compare(
        zeroResultCurrent.length,
        zeroResultPrevious.length,
      ),
      topZeroResultQueries,
      checkAvailabilityClicks: compare(checkClicksCurrent, checkClicksPrevious),
      curatedListViews,
    };
  }

  // -----------------------------------------------------------------
  // Helpers communs
  // -----------------------------------------------------------------

  private buildMeta(
    current: ReportPeriod,
    previous: ReportPeriod,
    includeBots: boolean,
  ): ReportMetaDto {
    return {
      from: current.from,
      to: current.to,
      previousFrom: previous.from,
      previousTo: previous.to,
      timezone: REPORTS_TIMEZONE,
      includeBots,
      generatedAt: new Date(),
    };
  }

  // §A1 — dédoublonnage DANS la requête (fonction fenêtrée LAG), jamais en
  // post-traitement : une même empreinte visiteur qui revoit le MÊME profil
  // dans les VIEW_DEDUP_WINDOW_MINUTES minutes ne compte qu'une fois. Le LAG
  // est calculé sur TOUT l'historique (pas seulement la période demandée) —
  // sinon une vue juste après le début de la période, continuation d'une
  // session commencée juste avant, serait comptée à tort comme nouvelle.
  private async dedupedProfileViewsBySpeaker(
    period: ReportPeriod,
    includeBots: boolean,
  ): Promise<Map<number, number>> {
    const rows = await this.prisma.$queryRaw<
      { speakerId: number; views: bigint }[]
    >`
      SELECT speaker_id AS speakerId, COUNT(*) AS views FROM (
        SELECT speaker_id, created_at,
          LAG(created_at) OVER (PARTITION BY visitor_hash, speaker_id ORDER BY created_at) AS prev_created_at
        FROM analytics_events
        WHERE type = 'PROFILE_VIEW'
          AND speaker_id IS NOT NULL
          AND (${includeBots} OR is_bot = 0)
      ) t
      WHERE created_at >= ${period.from} AND created_at < ${period.to}
        AND (prev_created_at IS NULL OR created_at > DATE_ADD(prev_created_at, INTERVAL ${VIEW_DEDUP_WINDOW_MINUTES} MINUTE))
      GROUP BY speaker_id
    `;
    return new Map(rows.map((r) => [r.speakerId, Number(r.views)]));
  }

  private async topViewedProfiles(
    period: ReportPeriod,
    includeBots: boolean,
  ): Promise<RankingItemDto[]> {
    const views = await this.dedupedProfileViewsBySpeaker(period, includeBots);
    const ids = [...views.keys()];
    if (ids.length === 0) return [];
    const speakers = await this.prisma.speaker.findMany({
      where: { id: { in: ids } },
      select: { id: true, publicName: true, firstName: true, lastName: true },
    });
    const byId = new Map(speakers.map((s) => [s.id, s]));
    return ids
      .map((id) => ({
        id,
        label: byId.has(id) ? speakerDisplayName(byId.get(id)!) : `#${id}`,
        count: views.get(id)!,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private async requestsCountBySpeaker(
    period: ReportPeriod,
  ): Promise<Map<number, number>> {
    const rows = await this.prisma.bookingRequestSpeaker.groupBy({
      by: ['speakerId'],
      where: { deletedAt: null, addedAt: { gte: period.from, lt: period.to } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.speakerId, r._count._all]));
  }

  private async missionsCountBySpeaker(
    period: ReportPeriod,
  ): Promise<Map<number, number>> {
    const rows = await this.prisma.mission.groupBy({
      by: ['speakerId'],
      where: {
        deletedAt: null,
        eventDate: { gte: period.from, lt: period.to },
      },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.speakerId, r._count._all]));
  }

  private async availabilityAcceptanceBySpeaker(
    period: ReportPeriod,
  ): Promise<Map<number, { total: number; accepted: number }>> {
    const rows = await this.prisma.availabilityRequest.groupBy({
      by: ['speakerId', 'responseStatus'],
      where: {
        responseStatus: { not: null },
        respondedAt: { gte: period.from, lt: period.to },
      },
      _count: { _all: true },
    });
    const result = new Map<number, { total: number; accepted: number }>();
    for (const row of rows) {
      const entry = result.get(row.speakerId) ?? { total: 0, accepted: 0 };
      entry.total += row._count._all;
      if (
        row.responseStatus &&
        (ACCEPTANCE_RESPONSE_STATUSES as readonly string[]).includes(
          row.responseStatus,
        )
      ) {
        entry.accepted += row._count._all;
      }
      result.set(row.speakerId, entry);
    }
    return result;
  }

  private async realizedRevenueBySpeaker(
    period: ReportPeriod,
  ): Promise<Map<number, number>> {
    const rows = await this.prisma.mission.groupBy({
      by: ['speakerId'],
      where: {
        deletedAt: null,
        eventDate: { gte: period.from, lt: period.to },
        status: { in: [...REALIZED_MISSION_STATUSES] },
      },
      _sum: { clientAmount: true },
    });
    return new Map(
      rows.map((r) => [r.speakerId, Number(r._sum.clientAmount ?? 0)]),
    );
  }

  // §14.1 — "classements transverses" : interprétés comme les FORMATS/
  // THÈMES des speakers effectivement PROPOSÉS sur une demande pendant la
  // période (booking_request_speakers), pas un champ texte libre côté
  // demande (voir DTO). Une même demande comptée une seule fois par
  // format/thème même si plusieurs de ses speakers candidats le partagent
  // (COUNT DISTINCT sur la ligne booking_request_speakers).
  private async topFormatsRequested(
    period: ReportPeriod,
  ): Promise<RankingItemDto[]> {
    const rows = await this.prisma.$queryRaw<
      { id: number; label: string; count: bigint }[]
    >`
      SELECT f.id AS id, f.name AS label, COUNT(DISTINCT brs.id) AS count
      FROM booking_request_speakers brs
      JOIN speaker_formats sf ON sf.speaker_id = brs.speaker_id
      JOIN formats f ON f.id = sf.format_id
      WHERE brs.deleted_at IS NULL AND brs.added_at >= ${period.from} AND brs.added_at < ${period.to}
      GROUP BY f.id, f.name
      ORDER BY count DESC
      LIMIT 10
    `;
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      count: Number(r.count),
    }));
  }

  private async topThemesRequested(
    period: ReportPeriod,
  ): Promise<RankingItemDto[]> {
    const rows = await this.prisma.$queryRaw<
      { id: number; label: string; count: bigint }[]
    >`
      SELECT t.id AS id, t.name AS label, COUNT(DISTINCT brs.id) AS count
      FROM booking_request_speakers brs
      JOIN speaker_themes st ON st.speaker_id = brs.speaker_id
      JOIN themes t ON t.id = st.theme_id
      WHERE brs.deleted_at IS NULL AND brs.added_at >= ${period.from} AND brs.added_at < ${period.to}
      GROUP BY t.id, t.name
      ORDER BY count DESC
      LIMIT 10
    `;
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      count: Number(r.count),
    }));
  }

  // CRM-lié uniquement (§ voir DTO) : préfère le pays de l'organisation
  // rattachée, retombe sur celui du contact rattaché si pas d'organisation.
  private async topClientCountries(
    period: ReportPeriod,
  ): Promise<RankingItemDto[]> {
    const rows = await this.prisma.$queryRaw<
      { id: number; label: string; count: bigint }[]
    >`
      SELECT country_id AS id, country_name AS label, COUNT(*) AS count FROM (
        SELECT br.id,
          COALESCE(o.country_id, c.country_id) AS country_id,
          COALESCE(oc.name, cc.name) AS country_name
        FROM booking_requests br
        LEFT JOIN organizations o ON o.id = br.organization_id
        LEFT JOIN contacts c ON c.id = br.contact_id
        LEFT JOIN countries oc ON oc.id = o.country_id
        LEFT JOIN countries cc ON cc.id = c.country_id
        WHERE br.created_at >= ${period.from} AND br.created_at < ${period.to}
      ) t
      WHERE country_id IS NOT NULL
      GROUP BY country_id, country_name
      ORDER BY count DESC
      LIMIT 10
    `;
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      count: Number(r.count),
    }));
  }

  private async requestsSeries(
    period: ReportPeriod,
  ): Promise<RequestsSeriesPointDto[]> {
    // Le pilote mysql2 renvoie DATE(...) sous forme d'objet Date JS (pas une
    // chaîne) — typé `unknown` ici plutôt que supposé, converti dans les
    // deux cas possibles.
    const rows = await this.prisma.$queryRaw<
      { date: unknown; count: bigint }[]
    >`
      SELECT DATE(created_at) AS date, COUNT(*) AS count
      FROM booking_requests
      WHERE created_at >= ${period.from} AND created_at < ${period.to}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
    return rows.map((r) => ({
      date:
        r.date instanceof Date
          ? r.date.toISOString().slice(0, 10)
          : String(r.date),
      count: Number(r.count),
    }));
  }

  private async requestsByServiceType(
    period: ReportPeriod,
  ): Promise<RankingItemDto[]> {
    const rows = await this.prisma.bookingRequest.groupBy({
      by: ['serviceType'],
      where: { createdAt: { gte: period.from, lt: period.to } },
      _count: { _all: true },
    });
    return rows
      .map((r, i) => ({ id: i, label: r.serviceType, count: r._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  // §A3 — dénominateur = demandes créées sur la période (voir
  // CONVERSION_RATE_DEFINITION) ; converties = au moins une mission NON
  // supprimée en est issue, quelle que soit la date de cette mission.
  private async conversionRate(period: ReportPeriod): Promise<number> {
    const rows = await this.prisma.$queryRaw<
      { total: bigint; converted: bigint }[]
    >`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM missions m WHERE m.booking_request_id = br.id AND m.deleted_at IS NULL
        ) THEN 1 ELSE 0 END) AS converted
      FROM booking_requests br
      WHERE br.created_at >= ${period.from} AND br.created_at < ${period.to}
    `;
    const total = Number(rows[0]?.total ?? 0);
    const converted = Number(rows[0]?.converted ?? 0);
    return total > 0 ? (converted / total) * 100 : 0;
  }

  private async averageFirstResponseHours(
    period: ReportPeriod,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ avgHours: number | null }[]>`
      SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, first_responded_at)) / 3600 AS avgHours
      FROM booking_requests
      WHERE created_at >= ${period.from} AND created_at < ${period.to}
        AND first_responded_at IS NOT NULL
    `;
    return Number(rows[0]?.avgHours ?? 0);
  }

  // Remplace "budget moyen" — voir CommercialReportDto : estimatedBudget est
  // un champ texte libre côté demande, jamais moyenné numériquement.
  private async averageMissionClientAmount(
    period: ReportPeriod,
  ): Promise<number> {
    const result = await this.prisma.mission.aggregate({
      where: {
        deletedAt: null,
        eventDate: { gte: period.from, lt: period.to },
        clientAmount: { not: null },
      },
      _avg: { clientAmount: true },
    });
    return Number(result._avg.clientAmount ?? 0);
  }

  private async cancelledRequestsCount(period: ReportPeriod): Promise<number> {
    return this.prisma.bookingRequest.count({
      where: {
        createdAt: { gte: period.from, lt: period.to },
        status: { in: ['CANCELLED', 'DECLINED'] },
      },
    });
  }

  private async topClientOrganizations(
    period: ReportPeriod,
  ): Promise<RankingItemDto[]> {
    const rows = await this.prisma.bookingRequest.groupBy({
      by: ['organizationId'],
      where: {
        createdAt: { gte: period.from, lt: period.to },
        organizationId: { not: null },
      },
      _count: { _all: true },
    });
    const ids = rows
      .map((r) => r.organizationId)
      .filter((id): id is number => id !== null);
    if (ids.length === 0) return [];
    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const byId = new Map(orgs.map((o) => [o.id, o.name]));
    return rows
      .map((r) => ({
        id: r.organizationId!,
        label: byId.get(r.organizationId!) ?? `#${r.organizationId}`,
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private async topBookedSpeakers(
    period: ReportPeriod,
  ): Promise<RankingItemDto[]> {
    const rows = await this.prisma.mission.groupBy({
      by: ['speakerId'],
      where: {
        deletedAt: null,
        eventDate: { gte: period.from, lt: period.to },
      },
      _count: { _all: true },
    });
    if (rows.length === 0) return [];
    const speakers = await this.prisma.speaker.findMany({
      where: { id: { in: rows.map((r) => r.speakerId) } },
      select: { id: true, publicName: true, firstName: true, lastName: true },
    });
    const byId = new Map(speakers.map((s) => [s.id, s]));
    return rows
      .map((r) => ({
        id: r.speakerId,
        label: byId.has(r.speakerId)
          ? speakerDisplayName(byId.get(r.speakerId)!)
          : `#${r.speakerId}`,
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // §A3/§A4 — chiffre d'affaires ET commission, RÉALISÉ vs PRÉVISIONNEL,
  // filtrés sur la fenêtre d'événement (eventDate) — réservé SUPER_ADMIN
  // (voir getCommercialReport).
  private async revenueAndCommission(period: ReportPeriod): Promise<{
    realizedRevenue: number;
    forecastRevenue: number;
    realizedCommission: number;
    forecastCommission: number;
  }> {
    const rows = await this.prisma.$queryRaw<
      {
        realizedRevenue: number | null;
        forecastRevenue: number | null;
        realizedCommission: number | null;
        forecastCommission: number | null;
      }[]
    >`
      SELECT
        SUM(CASE WHEN status IN (${Prisma.join(REALIZED_MISSION_STATUSES)}) THEN client_amount ELSE 0 END) AS realizedRevenue,
        SUM(CASE WHEN status IN (${Prisma.join(FORECAST_MISSION_STATUSES)}) THEN client_amount ELSE 0 END) AS forecastRevenue,
        SUM(CASE WHEN status IN (${Prisma.join(REALIZED_MISSION_STATUSES)}) THEN agency_commission ELSE 0 END) AS realizedCommission,
        SUM(CASE WHEN status IN (${Prisma.join(FORECAST_MISSION_STATUSES)}) THEN agency_commission ELSE 0 END) AS forecastCommission
      FROM missions
      WHERE deleted_at IS NULL AND event_date >= ${period.from} AND event_date < ${period.to}
    `;
    const row = rows[0];
    return {
      realizedRevenue: Number(row?.realizedRevenue ?? 0),
      forecastRevenue: Number(row?.forecastRevenue ?? 0),
      realizedCommission: Number(row?.realizedCommission ?? 0),
      forecastCommission: Number(row?.forecastCommission ?? 0),
    };
  }

  // -----------------------------------------------------------------
  // Éditorial — helpers
  // -----------------------------------------------------------------

  private async countByType(
    period: ReportPeriod,
    type: AnalyticsEventType,
    includeBots: boolean,
  ): Promise<number> {
    return this.prisma.analyticsEvent.count({
      where: {
        type,
        createdAt: { gte: period.from, lt: period.to },
        isBot: includeBots ? undefined : false,
      },
    });
  }

  // Récupère les payloads SEARCH bruts de la période — agrégés en JS
  // (JSON, voir plus haut) plutôt qu'en SQL : au volume "quelques centaines
  // de lignes" visé par ce module (§A1), c'est aussi rapide et bien plus
  // lisible qu'une extraction JSON dynamique par clé en SQL.
  private async searchPayloads(
    period: ReportPeriod,
    includeBots: boolean,
  ): Promise<SearchPayload[]> {
    const rows = await this.prisma.analyticsEvent.findMany({
      where: {
        type: 'SEARCH',
        createdAt: { gte: period.from, lt: period.to },
        isBot: includeBots ? undefined : false,
      },
      select: { payload: true },
    });
    return rows.map((r) => (r.payload as SearchPayload | null) ?? {});
  }

  private aggregateTopFilters(payloads: SearchPayload[]): RankingItemDto[] {
    const counts = new Map<string, number>();
    for (const payload of payloads) {
      for (const key of FILTER_KEYS) {
        const value = payload.filters?.[key];
        if (value !== undefined && value !== null && value !== '') {
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()]
      .map(([label, count], i) => ({ id: i, label, count }))
      .sort((a, b) => b.count - a.count);
  }

  private aggregateZeroResultQueries(
    payloads: SearchPayload[],
  ): ZeroResultSearchDto[] {
    const counts = new Map<string | null, number>();
    for (const payload of payloads) {
      const q = payload.filters?.q?.trim() || null;
      counts.set(q, (counts.get(q) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private async curatedListViews(
    period: ReportPeriod,
    includeBots: boolean,
  ): Promise<RankingItemDto[]> {
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['curatedListId'],
      where: {
        type: 'CURATED_LIST_VIEW',
        createdAt: { gte: period.from, lt: period.to },
        isBot: includeBots ? undefined : false,
        curatedListId: { not: null },
      },
      _count: { _all: true },
    });
    const ids = rows
      .map((r) => r.curatedListId)
      .filter((id): id is number => id !== null);
    if (ids.length === 0) return [];
    const lists = await this.prisma.curatedList.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });
    const byId = new Map(lists.map((l) => [l.id, l.title]));
    return rows
      .map((r) => ({
        id: r.curatedListId!,
        label: byId.get(r.curatedListId!) ?? `#${r.curatedListId}`,
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}
