import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryLoginEventsDto } from './dto/query-login-events.dto';
import { LoginEventListResponseDto } from './dto/outputs/login-event-item.dto';

export interface RecordLoginEventParams {
  userId: number | null;
  emailAttempted: string;
  success: boolean;
  failureReason?: string;
  ip: string;
  userAgent?: string;
}

const USER_REF_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

// -----------------------------------------------------------------------
// Pourquoi un sel FIXE ici, à l'inverse d'AnalyticsService (§26 vs §B2) :
// -----------------------------------------------------------------------
// analytics_events fait tourner son sel CHAQUE JOUR précisément pour rendre
// impossible la corrélation d'un même visiteur au-delà de 24h (anonymisation
// — voir AnalyticsService#computeVisitorHash). login_events poursuit le but
// EXACTEMENT INVERSE : "c'est ce qui permet de repérer une attaque par
// force brute" (§A3 du prompt) — une attaque par force brute réelle s'étale
// typiquement sur plusieurs jours (pour rester sous les seuils de
// rate-limiting). Un sel qui change à minuit romprait la corrélation entre
// "IP X a échoué 40 fois hier" et "IP X a échoué 40 fois aujourd'hui",
// rendant le motif invisible à un SUPER_ADMIN qui parcourt le journal.
// La garantie de vie privée reste la même qu'ailleurs (AUCUNE IP en clair
// stockée, seulement un HMAC-SHA256 non réversible sans connaître
// LOGIN_EVENTS_SALT, secret et jamais en base) — seule la fenêtre de
// corrélation change, en cohérence avec l'objectif de CET usage précis.
@Injectable()
export class LoginEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  computeIpHash(ip: string): string {
    const salt = this.config.get<string>('LOGIN_EVENTS_SALT') ?? '';
    return createHmac('sha256', salt).update(ip).digest('hex');
  }

  // Fire-and-forget par construction : appelé depuis AuthService#login,
  // jamais attendu de façon bloquante par la réponse HTTP (même principe
  // que AnalyticsService — journaliser une tentative de connexion ne doit
  // jamais faire échouer ni ralentir le login lui-même, réussi ou non).
  async record(params: RecordLoginEventParams): Promise<void> {
    try {
      await this.prisma.loginEvent.create({
        data: {
          userId: params.userId,
          emailAttempted: params.emailAttempted,
          success: params.success,
          failureReason: params.failureReason,
          ipHash: params.ip ? this.computeIpHash(params.ip) : undefined,
          userAgent: params.userAgent?.slice(0, 500),
        },
      });
    } catch {
      // Un échec de journalisation ne doit jamais faire échouer le login.
    }
  }

  async findAllForAdmin(
    query: QueryLoginEventsDto,
  ): Promise<LoginEventListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: Prisma.LoginEventWhereInput = {
      success: query.success,
      emailAttempted: query.email ? { contains: query.email } : undefined,
      createdAt:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
              lte: query.dateTo ? new Date(query.dateTo) : undefined,
            }
          : undefined,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.loginEvent.count({ where }),
      this.prisma.loginEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { user: { select: USER_REF_SELECT } },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        emailAttempted: row.emailAttempted,
        success: row.success,
        failureReason: row.failureReason,
        ipHash: row.ipHash,
        userAgent: row.userAgent,
        user: row.user,
        createdAt: row.createdAt,
      })),
      meta: { total, page, perPage },
    };
  }
}
