import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryEmailDeliveriesDto } from './dto/query-email-deliveries.dto';
import {
  EmailDeliveryListResponseDto,
  EmailDeliverySummaryDto,
} from './dto/outputs/email-delivery-item.dto';

// Lecture seule (§E) — MailService#sendAndLog est le SEUL point d'écriture
// de email_deliveries. Aucune agrégation, aucun mécanisme de réessai :
// juste la visibilité sur ce qui a été tenté.
@Injectable()
export class EmailDeliveriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForAdmin(
    query: QueryEmailDeliveriesDto,
  ): Promise<EmailDeliveryListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: Prisma.EmailDeliveryWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.attemptedAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.emailDelivery.count({ where }),
      this.prisma.emailDelivery.findMany({
        where,
        orderBy: { attemptedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: rows,
      meta: { total, page, perPage },
    };
  }

  // Utilisé par BookingRequestsService/RosterApplicationsService pour
  // enrichir leur vue détaillée (§E) — voir EmailDeliverySummaryDto pour le
  // choix de renvoyer l'historique complet plutôt que le seul dernier envoi.
  async findForEntity(
    relatedEntityType: string,
    relatedEntityId: number,
  ): Promise<EmailDeliverySummaryDto[]> {
    return this.prisma.emailDelivery.findMany({
      where: { relatedEntityType, relatedEntityId },
      orderBy: { attemptedAt: 'desc' },
      select: {
        id: true,
        template: true,
        status: true,
        errorMessage: true,
        attemptedAt: true,
        sentAt: true,
      },
    });
  }
}
