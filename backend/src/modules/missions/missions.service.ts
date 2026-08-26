import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingRequestSpeakerStatus,
  BookingStatus,
  MissionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { MailService } from '../../mail/mail.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { sanitizeOptionalText } from '../../common/utils/sanitize-text.util';
import { createWithUniqueReference } from '../../common/utils/reference-generator.util';
import { resolveOwnSpeakerId } from '../speakers/resolve-own-speaker.util';
import {
  getForwardMissionTransitions,
  isMissionTransitionAllowed,
  isTerminalMissionStatus,
} from './mission-status-transitions.util';
import { MISSION_CHECKLIST_TEMPLATE } from './mission-checklist.constants';
import {
  MISSION_LIST_SELECT,
  MISSION_SELECT,
  MissionRow,
} from './missions.includes';
import {
  toAdminDetailDto,
  toAdminListItemDto,
  toSpeakerDto,
} from './mappers/mission.mapper';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { UpdateMissionStatusDto } from './dto/update-mission-status.dto';
import { QueryMissionsDto } from './dto/query-missions.dto';
import {
  MissionAdminDetailDto,
  MissionListResponseDto,
} from './dto/outputs/mission-admin.dto';
import { MissionSpeakerDto } from './dto/outputs/mission-speaker.dto';
import { toChecklistDto } from './mappers/mission-checklist.mapper';
import { toDocumentDto } from './mappers/mission-document.mapper';
import { toMessageDto } from './mappers/mission-message.mapper';
import { MissionHistoryEntryDto } from './dto/outputs/mission-history-entry.dto';

@Injectable()
export class MissionsService {
  private readonly logger = new Logger(MissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly appSettings: AppSettingsService,
  ) {}

  // ---------------------------------------------------------------------
  // ADMIN — création (§1)
  // ---------------------------------------------------------------------

  // §1 — action EXPLICITE de l'admin, JAMAIS un effet de bord automatique
  // (voir BookingRequestsService#onConfirmed, désormais documenté comme
  // délibérément non câblé). Conditions : demande en CONFIRMED ou
  // CONTRACT_IN_PREPARATION, et speaker rattaché via booking_request_speakers.
  async create(
    bookingRequestId: number,
    dto: CreateMissionDto,
    actor: AuthenticatedUser,
  ): Promise<MissionAdminDetailDto> {
    const bookingRequest = await this.prisma.bookingRequest.findUnique({
      where: { id: bookingRequestId },
    });
    if (!bookingRequest) {
      throw new NotFoundException(`Demande ${bookingRequestId} introuvable.`);
    }
    if (
      bookingRequest.status !== BookingStatus.CONFIRMED &&
      bookingRequest.status !== BookingStatus.CONTRACT_IN_PREPARATION
    ) {
      throw new BadRequestException(
        `Une mission ne peut être créée que depuis une demande "CONFIRMED" ou "CONTRACT_IN_PREPARATION" (statut actuel : "${bookingRequest.status}").`,
      );
    }

    const candidate = await this.prisma.bookingRequestSpeaker.findFirst({
      where: {
        requestId: bookingRequestId,
        speakerId: dto.speakerId,
        deletedAt: null,
      },
    });
    if (!candidate) {
      throw new BadRequestException(
        `Speaker ${dto.speakerId} n'est pas rattaché à la demande ${bookingRequestId} (booking_request_speakers).`,
      );
    }

    // §A4 — devise par défaut lue depuis app_settings (hors transaction,
    // lecture seule sans lien avec `tx`) : remplace l'ancien repli implicite
    // sur le `@default("USD")` du schéma, qui reste en place comme tout
    // dernier filet si jamais ce code changeait sans passer par ici.
    const defaultCurrency = (await this.appSettings.getEffectiveSettings())
      .defaultCurrency;

    let mission: MissionRow;
    try {
      mission = await this.prisma.$transaction(async (tx) => {
        const created = await createWithUniqueReference({
          prefix: 'MSN',
          countForYear: (year) =>
            tx.mission.count({
              where: { reference: { startsWith: `MSN-${year}-` } },
            }),
          attemptCreate: (reference) =>
            tx.mission.create({
              data: {
                reference,
                bookingRequestId,
                speakerId: dto.speakerId,
                organizationId: bookingRequest.organizationId,
                contactId: bookingRequest.contactId,
                serviceType: bookingRequest.serviceType,
                eventDate: bookingRequest.eventDate ?? new Date(),
                topic: bookingRequest.primaryTopics ?? '',
                currency: defaultCurrency,
                createdById: actor.id,
                // §1 — encode le couple (bookingRequestId, speakerId), voir
                // schema.prisma. Le P2002 sur cette colonne, s'il survient,
                // est traduit en 409 ci-dessous.
                activeGuard: `${bookingRequestId}-${dto.speakerId}`,
              },
              select: MISSION_SELECT,
            }),
        });

        // §1 — la création passe le rattachement en SELECTED.
        await tx.bookingRequestSpeaker.update({
          where: { id: candidate.id },
          data: { status: BookingRequestSpeakerStatus.SELECTED },
        });

        // §4 — les 15 points instanciés en lignes à la création.
        await tx.missionChecklistItem.createMany({
          data: MISSION_CHECKLIST_TEMPLATE.map((item) => ({
            missionId: created.id,
            code: item.code,
            label: item.label,
            displayOrder: item.displayOrder,
          })),
        });

        await this.activityLog.record(tx, {
          actorId: actor.id,
          action: 'mission.created',
          entityType: 'Mission',
          entityId: created.id,
          oldValue: null,
          newValue: { bookingRequestId, speakerId: dto.speakerId },
        });

        return created;
      });
    } catch (error) {
      if (this.isPrismaUniqueConflict(error)) {
        throw new ConflictException(
          `Une mission est déjà active pour le speaker ${dto.speakerId} sur la demande ${bookingRequestId}.`,
        );
      }
      throw error;
    }

    // §9 — email au speaker APRÈS le commit, jamais dedans.
    await this.notifySpeakerMissionCreated(mission);

    return this.findOneForAdmin(mission.id);
  }

  // ---------------------------------------------------------------------
  // ADMIN — liste et détail (§8)
  // ---------------------------------------------------------------------

  async findAllForAdmin(
    query: QueryMissionsDto,
  ): Promise<MissionListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where = this.buildWhere(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.mission.count({ where }),
      this.prisma.mission.findMany({
        where,
        orderBy: { eventDate: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: MISSION_LIST_SELECT,
      }),
    ]);

    return {
      data: rows.map(toAdminListItemDto),
      meta: { total, page, perPage },
    };
  }

  async findOneForAdmin(id: number): Promise<MissionAdminDetailDto> {
    const mission = await this.prisma.mission.findFirst({
      where: { id, deletedAt: null },
      select: MISSION_SELECT,
    });
    if (!mission) {
      throw new NotFoundException(`Mission ${id} introuvable.`);
    }
    return this.composeAdminDetail(mission);
  }

  // GET /admin/missions/:id/history (§8) — flux unique depuis activity_logs,
  // même principe que BookingRequestsService#getHistory (§2.7) : toutes les
  // actions relatives à cette mission (création, statut, champs, checklist,
  // documents, messages, acceptation) journalisent DÉJÀ sous
  // entityType='Mission', entityId=:id — voir mission-checklist.service.ts/
  // mission-documents.service.ts/mission-messages.service.ts.
  async getHistory(id: number): Promise<MissionHistoryEntryDto[]> {
    const exists = await this.prisma.mission.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Mission ${id} introuvable.`);
    }

    const rows = await this.prisma.activityLog.findMany({
      where: { entityType: 'Mission', entityId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actor
        ? {
            id: row.actor.id,
            email: row.actor.email,
            firstName: row.actor.firstName,
            lastName: row.actor.lastName,
          }
        : null,
      oldValue: row.oldValue,
      newValue: row.newValue,
      createdAt: row.createdAt,
    }));
  }

  async update(
    id: number,
    dto: UpdateMissionDto,
    actor: AuthenticatedUser,
  ): Promise<MissionAdminDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.mission.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Mission ${id} introuvable.`);
      }

      const updated = await tx.mission.update({
        where: { id },
        data: {
          eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
          startTime: dto.startTime,
          endTime: dto.endTime,
          timezone: dto.timezone,
          locationCountryId: dto.locationCountryId,
          address: sanitizeOptionalText(dto.address),
          isVirtual: dto.isVirtual,
          virtualLink: dto.virtualLink,
          onSiteContactName: dto.onSiteContactName,
          onSiteContactPhone: dto.onSiteContactPhone,
          durationMinutes: dto.durationMinutes,
          topic: dto.topic,
          language: dto.language,
          format: dto.format,
          participantCount: dto.participantCount,
          clientAmount: dto.clientAmount,
          speakerAmount: dto.speakerAmount,
          agencyCommission: dto.agencyCommission,
          expenses: dto.expenses,
          currency: dto.currency,
          contractStatus: dto.contractStatus,
          paymentStatus: dto.paymentStatus,
          logisticsStatus: dto.logisticsStatus,
          internalNotes:
            dto.internalNotes !== undefined
              ? sanitizeOptionalText(dto.internalNotes)
              : undefined,
        },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'mission.updated',
        entityType: 'Mission',
        entityId: id,
        oldValue: null,
        newValue: { fields: Object.keys(dto) },
      });

      return updated;
    });

    return this.findOneForAdmin(id);
  }

  // §3 — sauts en avant toujours permis, retours en arrière réservés
  // SUPER_ADMIN (journalisés distinctement). CANCELLED : motif obligatoire
  // (déjà validé par le DTO), atteignable depuis tout statut non terminal.
  // N'annule PAS la demande client associée (cycles de vie distincts,
  // aucune écriture sur bookingRequest ici).
  async updateStatus(
    id: number,
    dto: UpdateMissionStatusDto,
    actor: AuthenticatedUser,
  ): Promise<MissionAdminDetailDto> {
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.mission.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Mission ${id} introuvable.`);
      }

      if (
        !isMissionTransitionAllowed(existing.status, dto.status, isSuperAdmin)
      ) {
        const allowed = getForwardMissionTransitions(existing.status);
        const allowedList =
          allowed.length > 0
            ? allowed.join(', ')
            : '(aucune — statut terminal)';
        throw new BadRequestException(
          `Transition refusée : "${existing.status}" -> "${dto.status}". Transitions possibles depuis "${existing.status}" : ${allowedList} (un retour en arrière est réservé SUPER_ADMIN).`,
        );
      }

      const isBackward =
        !isTerminalMissionStatus(existing.status) &&
        dto.status !== MissionStatus.CANCELLED &&
        !getForwardMissionTransitions(existing.status).includes(dto.status);

      const isTerminal =
        dto.status === MissionStatus.CANCELLED ||
        dto.status === MissionStatus.COMPLETED;

      const updated = await tx.mission.update({
        where: { id },
        data: {
          status: dto.status,
          cancellationReason:
            dto.status === MissionStatus.CANCELLED
              ? sanitizeOptionalText(dto.cancellationReason)
              : undefined,
          // §1 — terminal (COMPLETED/CANCELLED) : libère le couple
          // (bookingRequestId, speakerId) pour une future mission.
          activeGuard: isTerminal ? null : undefined,
        },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: isBackward
          ? 'mission.status_reverted'
          : 'mission.status_changed',
        entityType: 'Mission',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: {
          status: updated.status,
          cancellationReason: updated.cancellationReason,
          revertedBySuperAdmin: isBackward,
        },
      });

      return updated;
    });

    if (dto.status === MissionStatus.CONFIRMED) {
      const mission = await this.prisma.mission.findUniqueOrThrow({
        where: { id },
        select: MISSION_SELECT,
      });
      await this.notifySpeakerMissionConfirmed(mission);
    }

    return this.findOneForAdmin(id);
  }

  // ---------------------------------------------------------------------
  // SPEAKER (§6) — scoping EXCLUSIVEMENT via resolveOwnSpeakerId
  // (Speaker.userId = actor.id), jamais un id fourni par l'appelant.
  // ---------------------------------------------------------------------

  async findOwnMissions(
    actor: AuthenticatedUser,
  ): Promise<MissionSpeakerDto[]> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    const rows = await this.prisma.mission.findMany({
      where: { speakerId, deletedAt: null },
      orderBy: { eventDate: 'desc' },
      select: MISSION_SELECT,
    });
    return rows.map(toSpeakerDto);
  }

  async findOwnMission(
    actor: AuthenticatedUser,
    id: number,
  ): Promise<MissionSpeakerDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    const row = await this.prisma.mission.findFirst({
      where: { id, speakerId, deletedAt: null },
      select: MISSION_SELECT,
    });
    // 404 générique — un id d'une AUTRE mission (même d'un autre speaker)
    // doit être indiscernable d'un id qui n'existe pas (§6).
    if (!row) {
      throw new NotFoundException(`Mission ${id} introuvable.`);
    }
    return toSpeakerDto(row);
  }

  // §6 — acceptation DÉFINITIVE, DISTINCTE de la réponse de disponibilité
  // de la 3d : c'est ICI que le speaker s'engage. Une mission annulée ne
  // peut plus être acceptée.
  async acceptOwnMission(
    actor: AuthenticatedUser,
    id: number,
  ): Promise<MissionSpeakerDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);

    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.mission.findFirst({
        where: { id, speakerId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Mission ${id} introuvable.`);
      }
      if (existing.status === MissionStatus.CANCELLED) {
        throw new BadRequestException(
          "Cette mission a été annulée — impossible de l'accepter.",
        );
      }
      if (existing.acceptedAt !== null) {
        throw new BadRequestException('Cette mission a déjà été acceptée.');
      }

      const updated = await tx.mission.update({
        where: { id },
        data: { acceptedAt: new Date(), acceptedById: actor.id },
        select: MISSION_SELECT,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'mission.accepted',
        entityType: 'Mission',
        entityId: id,
        oldValue: { acceptedAt: null },
        newValue: { acceptedAt: updated.acceptedAt?.toISOString() },
      });

      return updated;
    });

    // §9 — email à l'admin APRÈS le commit.
    await this.notifyAdminMissionAccepted(row);

    return toSpeakerDto(row);
  }

  async acknowledgeBriefOwnMission(
    actor: AuthenticatedUser,
    id: number,
  ): Promise<MissionSpeakerDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);

    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.mission.findFirst({
        where: { id, speakerId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Mission ${id} introuvable.`);
      }

      const updated = await tx.mission.update({
        where: { id },
        data: { briefAcknowledgedAt: new Date() },
        select: MISSION_SELECT,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'mission.brief_acknowledged',
        entityType: 'Mission',
        entityId: id,
        oldValue: null,
        newValue: {
          briefAcknowledgedAt: updated.briefAcknowledgedAt?.toISOString(),
        },
      });

      return updated;
    });

    return toSpeakerDto(row);
  }

  // ---------------------------------------------------------------------
  // Composition du détail admin (checklist + documents + messages) —
  // réutilisée par create()/findOneForAdmin()/update()/updateStatus().
  // ---------------------------------------------------------------------

  async composeAdminDetail(
    mission: MissionRow,
  ): Promise<MissionAdminDetailDto> {
    const [checklistRows, documentRows, messageRows] = await Promise.all([
      this.prisma.missionChecklistItem.findMany({
        where: { missionId: mission.id },
        orderBy: { displayOrder: 'asc' },
        include: { doneBy: { select: { email: true } } },
      }),
      this.prisma.missionDocument.findMany({
        where: { missionId: mission.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { email: true } } },
      }),
      this.prisma.missionMessage.findMany({
        where: { missionId: mission.id },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { email: true } } },
      }),
    ]);

    const checklist = checklistRows.map(toChecklistDto);
    const progress =
      checklist.length === 0
        ? 0
        : Math.round(
            (checklist.filter((c) => c.isDone).length / checklist.length) * 100,
          );

    return toAdminDetailDto(
      mission,
      checklist,
      progress,
      documentRows.map(toDocumentDto),
      messageRows.map(toMessageDto),
    );
  }

  // ---------------------------------------------------------------------
  // Privé
  // ---------------------------------------------------------------------

  private buildWhere(query: QueryMissionsDto): Prisma.MissionWhereInput {
    const where: Prisma.MissionWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.contractStatus) where.contractStatus = query.contractStatus;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.speakerId) where.speakerId = query.speakerId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.createdById) where.createdById = query.createdById;
    // Un seul objet de filtre construit à part (pas de spread successif sur
    // `where.eventDate`, dont le type union Date | Filter | undefined ne se
    // prête pas à ça) : dateFrom/dateTo/upcoming/past se combinent tous
    // dans les mêmes bornes gte/lte.
    const eventDateFilter: Prisma.DateTimeFilter = {};
    if (query.dateFrom) eventDateFilter.gte = new Date(query.dateFrom);
    if (query.dateTo) eventDateFilter.lte = new Date(query.dateTo);
    if (query.upcoming) eventDateFilter.gte = new Date();
    if (query.past) eventDateFilter.lt = new Date();
    if (Object.keys(eventDateFilter).length > 0) {
      where.eventDate = eventDateFilter;
    }
    return where;
  }

  private isPrismaUniqueConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  // §9 — notifications, toutes APRÈS le commit, jamais dans une transaction
  // (CLAUDE.md §10). Un échec n'annule jamais l'opération.

  private async notifySpeakerMissionCreated(
    mission: MissionRow,
  ): Promise<void> {
    const speaker = await this.prisma.speaker.findUnique({
      where: { id: mission.speakerId },
      select: { user: { select: { email: true } } },
    });
    if (!speaker?.user) return;
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    try {
      await this.mailService.sendMissionCreatedNotification({
        to: speaker.user.email,
        reference: mission.reference,
        missionUrl: `${frontendUrl}/missions/${mission.id}`,
        relatedEntityId: mission.id,
      });
    } catch (error) {
      this.logger.error(
        `Échec de la notification de création pour la mission ${mission.reference}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private async notifySpeakerMissionConfirmed(
    mission: MissionRow,
  ): Promise<void> {
    const speaker = await this.prisma.speaker.findUnique({
      where: { id: mission.speakerId },
      select: { user: { select: { email: true } } },
    });
    if (!speaker?.user) return;
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    try {
      await this.mailService.sendMissionConfirmedNotification({
        to: speaker.user.email,
        reference: mission.reference,
        missionUrl: `${frontendUrl}/missions/${mission.id}`,
        relatedEntityId: mission.id,
      });
    } catch (error) {
      this.logger.error(
        `Échec de la notification de confirmation pour la mission ${mission.reference}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private async notifyAdminMissionAccepted(mission: MissionRow): Promise<void> {
    const teamEmail = (await this.appSettings.getEffectiveSettings()).teamEmail;
    if (!teamEmail) return;
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    try {
      await this.mailService.sendMissionAcceptedNotification({
        to: teamEmail,
        reference: mission.reference,
        backOfficeUrl: `${frontendUrl}/missions/${mission.id}`,
        relatedEntityId: mission.id,
      });
    } catch (error) {
      this.logger.error(
        `Échec de la notification d'acceptation pour la mission ${mission.reference}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
