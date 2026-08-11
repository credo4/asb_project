import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnalyticsEventType,
  CuratedListStatus,
  Prisma,
  SpeakerStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAnalyticsEventsDto } from './dto/query-analytics-events.dto';
import { AnalyticsEventListResponseDto } from './dto/outputs/analytics-event-item.dto';
import {
  BOT_USER_AGENT_PATTERNS,
  MAX_REFERRER_LENGTH,
  MAX_USER_AGENT_LENGTH,
} from './analytics.constants';

export interface RecordEventParams {
  type: AnalyticsEventType;
  speakerId?: number;
  curatedListId?: number;
  payload?: Prisma.InputJsonValue;
  ip: string;
  userAgent?: string;
  referrer?: string;
}

// -----------------------------------------------------------------------
// Pourquoi un sel qui change CHAQUE JOUR plutôt qu'un sel fixe (§B2) :
// -----------------------------------------------------------------------
// Un HMAC-SHA256(IP + user-agent) avec un sel FIXE serait un pseudonyme
// STABLE dans le temps : la même personne produirait le même `visitorHash`
// aujourd'hui, demain, dans un an. Ce hash stable deviendrait alors une clé
// de corrélation implicite — croisable avec d'autres jeux de données (logs
// serveur, un autre tracker, un identifiant de session ailleurs) pour
// reconstituer un historique de navigation complet d'un individu. C'est
// exactement le problème que le RGPD vise : un pseudonyme durable est
// souvent aussi identifiant qu'une donnée directement nominative dès qu'on
// peut le recouper.
//
// En faisant dépendre le sel de LA DATE DU JOUR (dérivé de ANALYTICS_SALT +
// date UTC), le hash change automatiquement à minuit : on peut toujours
// distinguer deux visiteurs AU SEIN d'une même journée (utile pour compter
// des visiteurs uniques quotidiens, détecter un même visiteur qui revoit
// plusieurs profils dans sa session), mais le lien entre "visiteur du 5 août"
// et "visiteur du 6 août" devient CRYPTOGRAPHIQUEMENT impossible à
// reconstituer, même en connaissant l'IP et le user-agent d'origine — il
// faudrait deviner ANALYTICS_SALT (secret, jamais en base) ET recalculer
// pour chaque jour candidat. La donnée stockée n'est donc plus
// ré-identifiable au-delà d'une fenêtre de 24h glissante.
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  computeVisitorHash(ip: string, userAgent: string): string {
    const salt = this.config.get<string>('ANALYTICS_SALT') ?? '';
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const dailyKey = `${salt}:${today}`;
    return createHmac('sha256', dailyKey)
      .update(`${ip}:${userAgent}`)
      .digest('hex');
  }

  isBotUserAgent(userAgent: string | undefined): boolean {
    if (!userAgent) return false;
    return BOT_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent));
  }

  // Écriture « fire and forget » (§B4) : capture TOUTE erreur en interne,
  // ne la propage JAMAIS — un problème d'analytics ne doit jamais empêcher
  // un visiteur de voir un profil ou d'effectuer une recherche. Voir aussi
  // fire-and-forget.util.ts pour le filet de sécurité côté appelant.
  async record(params: RecordEventParams): Promise<void> {
    try {
      // AUCUNE IP en clair : seul `visitorHash` (dérivé, non réversible)
      // est écrit — voir le commentaire de classe ci-dessus.
      const visitorHash = this.computeVisitorHash(
        params.ip,
        params.userAgent ?? '',
      );
      const isBot = this.isBotUserAgent(params.userAgent);

      await this.prisma.analyticsEvent.create({
        data: {
          type: params.type,
          speakerId: params.speakerId,
          curatedListId: params.curatedListId,
          payload: params.payload,
          visitorHash,
          isBot,
          userAgent: params.userAgent?.slice(0, MAX_USER_AGENT_LENGTH),
          referrer: params.referrer?.slice(0, MAX_REFERRER_LENGTH),
        },
      });
    } catch (error) {
      this.logger.error(
        "Échec de l'enregistrement d'un événement analytics (ignoré, fire-and-forget)",
        error instanceof Error ? error.stack : error,
      );
    }
  }

  // Consolidation, Partie C — résout un slug PUBLIC (jamais un id) en
  // identifiant interne, AVANT tout enregistrement. `null` = slug inconnu
  // OU speaker non publié/masqué : dans les deux cas, l'appelant doit
  // ignorer l'événement plutôt que d'écrire un id trompeur (voir
  // PublicAnalyticsController).
  async resolveSpeakerIdBySlug(slug: string): Promise<number | null> {
    const speaker = await this.prisma.speaker.findFirst({
      where: {
        slug,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    return speaker?.id ?? null;
  }

  async resolveCuratedListIdBySlug(slug: string): Promise<number | null> {
    const list = await this.prisma.curatedList.findFirst({
      where: { slug, status: CuratedListStatus.PUBLISHED, deletedAt: null },
      select: { id: true },
    });
    return list?.id ?? null;
  }

  // GET /admin/analytics/events (§B6) — UNIQUEMENT pour vérifier que les
  // événements arrivent bien. Aucune agrégation ici : les statistiques sont
  // la Phase 4.
  async findAllForAdmin(
    query: QueryAnalyticsEventsDto,
  ): Promise<AnalyticsEventListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: Prisma.AnalyticsEventWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.analyticsEvent.count({ where }),
      this.prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        type: row.type,
        speakerId: row.speakerId,
        curatedListId: row.curatedListId,
        payload: row.payload as Record<string, unknown> | null,
        isBot: row.isBot,
        referrer: row.referrer,
        createdAt: row.createdAt,
      })),
      meta: { total, page, perPage },
    };
  }
}

// Politique de rétention (purge du brut au-delà de 13 mois) : PAS
// implémentée à cette étape — voir le commentaire sur le modèle
// AnalyticsEvent dans schema.prisma. À construire quand les besoins de la
// Phase 4 seront connus (tâche cron dédiée, probablement).
