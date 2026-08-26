import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AvailabilityRequestStatus,
  BookingRequestSpeakerStatus,
  BookingStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { MailService } from '../../mail/mail.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { sanitizeOptionalText } from '../../common/utils/sanitize-text.util';
import { resolveOwnSpeakerId } from '../speakers/resolve-own-speaker.util';
import { parseDateOnly } from '../speaker-availability/availability-date.util';
import { isBookingStatusTransitionAllowed } from '../booking-requests/booking-request-status-transitions.util';
import { isBookingRequestSpeakerTransitionAllowed } from '../booking-requests/booking-request-speaker-status-transitions.util';
import { BookingRequestsService } from '../booking-requests/booking-requests.service';
import { SendAvailabilityRequestDto } from './dto/send-availability-request.dto';
import { RespondAvailabilityRequestDto } from './dto/respond-availability-request.dto';
import { AvailabilityRequestAdminDto } from './dto/outputs/availability-request-admin.dto';
import { AvailabilityRequestBriefingDto } from './dto/outputs/availability-request-briefing.dto';
import {
  AVAILABILITY_REQUEST_SELECT,
  AvailabilityRequestRow,
} from './availability-requests.includes';
import {
  toAdminDto,
  toBriefingDto,
} from './mappers/availability-request.mapper';
import { DEFAULT_AVAILABILITY_RESPONSE_DAYS } from './availability-request.constants';

@Injectable()
export class AvailabilityRequestsService {
  private readonly logger = new Logger(AvailabilityRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly bookingRequestsService: BookingRequestsService,
  ) {}

  // ---------------------------------------------------------------------
  // ADMIN — envoi (§3)
  // ---------------------------------------------------------------------

  async send(
    dto: SendAvailabilityRequestDto,
    actor: AuthenticatedUser,
  ): Promise<AvailabilityRequestAdminDto> {
    const bookingRequest = await this.prisma.bookingRequest.findUnique({
      where: { id: dto.bookingRequestId },
    });
    if (!bookingRequest) {
      throw new NotFoundException(
        `Demande ${dto.bookingRequestId} introuvable.`,
      );
    }

    const speaker = await this.prisma.speaker.findFirst({
      where: { id: dto.speakerId, deletedAt: null },
      select: { id: true, userId: true, user: { select: { email: true } } },
    });
    if (!speaker) {
      throw new NotFoundException(`Speaker ${dto.speakerId} introuvable.`);
    }
    // §4 — le speaker répond via le portail (Speaker.userId = actor.id) :
    // sans compte lié, il n'existe AUCUN moyen pour lui de voir/répondre à
    // la sollicitation. Refusé explicitement plutôt que d'envoyer un email
    // vers une impasse.
    if (!speaker.userId || !speaker.user) {
      throw new BadRequestException(
        `Speaker ${dto.speakerId} n'a pas de compte connecté au portail — impossible de lui envoyer une sollicitation qu'il ne pourrait pas consulter.`,
      );
    }

    const candidate = await this.prisma.bookingRequestSpeaker.findFirst({
      where: {
        requestId: dto.bookingRequestId,
        speakerId: dto.speakerId,
        deletedAt: null,
      },
    });
    if (!candidate) {
      throw new BadRequestException(
        `Speaker ${dto.speakerId} doit d'abord être ajouté à la sélection de la demande ${dto.bookingRequestId} (POST .../speakers) avant de lui envoyer une sollicitation.`,
      );
    }
    if (
      !isBookingRequestSpeakerTransitionAllowed(
        candidate.status,
        BookingRequestSpeakerStatus.AVAILABILITY_REQUESTED,
      )
    ) {
      throw new BadRequestException(
        `Impossible d'envoyer une sollicitation : le candidat est actuellement "${candidate.status}".`,
      );
    }

    const eventDate = parseDateOnly(dto.eventDate);
    const eventEndDate = dto.eventEndDate
      ? parseDateOnly(dto.eventEndDate)
      : eventDate;
    const respondDueAt = dto.respondDueAt
      ? new Date(dto.respondDueAt)
      : new Date(
          Date.now() +
            this.config.get<number>(
              'AVAILABILITY_RESPONSE_TTL_DAYS',
              DEFAULT_AVAILABILITY_RESPONSE_DAYS,
            ) *
              24 *
              60 *
              60 *
              1000,
        );

    let row: AvailabilityRequestRow;
    try {
      row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.availabilityRequest.create({
          data: {
            bookingRequestId: dto.bookingRequestId,
            speakerId: dto.speakerId,
            sentById: actor.id,
            respondDueAt,
            eventType: dto.eventType,
            eventDate,
            eventEndDate: dto.eventEndDate ? eventEndDate : null,
            locationCountryId: dto.locationCountryId,
            isVirtual: dto.isVirtual ?? false,
            durationMinutes: dto.durationMinutes,
            topic: dto.topic,
            audienceDescription: sanitizeOptionalText(dto.audienceDescription),
            audienceSize: dto.audienceSize,
            language: dto.language,
            proposedFeeAmount: dto.proposedFeeAmount,
            proposedFeeCurrency: dto.proposedFeeCurrency,
            travelConditions: sanitizeOptionalText(dto.travelConditions),
            additionalNotes: sanitizeOptionalText(dto.additionalNotes),
            // §3.3 — voir schema.prisma : encode le COUPLE, NULL uniquement
            // quand le statut est terminal (posé ici puisqu'on CRÉE en SENT).
            activeGuard: `${dto.bookingRequestId}-${dto.speakerId}`,
          },
          select: AVAILABILITY_REQUEST_SELECT,
        });

        await tx.bookingRequestSpeaker.update({
          where: { id: candidate.id },
          data: { status: BookingRequestSpeakerStatus.AVAILABILITY_REQUESTED },
        });

        await this.activityLog.record(tx, {
          actorId: actor.id,
          action: 'availability_request.sent',
          entityType: 'AvailabilityRequest',
          entityId: created.id,
          oldValue: null,
          newValue: {
            bookingRequestId: dto.bookingRequestId,
            speakerId: dto.speakerId,
          },
        });

        return created;
      });
    } catch (error) {
      if (this.isPrismaUniqueConflict(error)) {
        throw new ConflictException(
          `Une sollicitation est déjà active pour le speaker ${dto.speakerId} sur la demande ${dto.bookingRequestId} — attendez sa réponse, son expiration, ou annulez-la avant d'en renvoyer une.`,
        );
      }
      throw error;
    }

    // §2 — l'envoi PEUT faire passer la demande en AWAITING_SPEAKER,
    // UNIQUEMENT via la machine à états validée de la 3b (jamais une
    // écriture directe) : n'agit que si la transition est licite depuis
    // l'état ACTUEL, sinon ne fait rien (comportement "peut", pas "doit" —
    // ce n'est pas une erreur si le statut ne s'y prête pas).
    await this.tryTransitionToAwaitingSpeaker(dto.bookingRequestId, actor);

    // §5 — email APRÈS le commit, jamais dedans (CLAUDE.md §10). Un échec
    // n'annule PAS l'envoi de la sollicitation : elle existe déjà en base.
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    try {
      await this.mailService.sendAvailabilityRequestNotification({
        to: speaker.user.email,
        eventType: dto.eventType,
        eventDate: dto.eventDate,
        opportunityUrl: `${frontendUrl}/opportunities/${row.id}`,
        relatedEntityId: row.id,
      });
    } catch (error) {
      this.logger.error(
        `Échec de la notification de sollicitation pour le speaker ${dto.speakerId} (availability_request #${row.id})`,
        error instanceof Error ? error.stack : error,
      );
    }

    return toAdminDto(row);
  }

  // GET /admin/availability-requests?bookingRequestId=X -- lecture seule
  // (voir ListAvailabilityRequestsDto). Toutes les sollicitations envoyées
  // pour cette demande, tous speakers confondus : le bloc "Speakers
  // proposés" du back-office les recroise par speakerId côté client.
  // Triées par date d'envoi décroissante -- s'il y en a plusieurs pour un
  // même speaker (une ancienne EXPIRED/CANCELLED, une nouvelle SENT), la
  // plus récente arrive en premier.
  async findForBookingRequest(
    bookingRequestId: number,
  ): Promise<AvailabilityRequestAdminDto[]> {
    const rows = await this.prisma.availabilityRequest.findMany({
      where: { bookingRequestId },
      orderBy: { sentAt: 'desc' },
      select: AVAILABILITY_REQUEST_SELECT,
    });
    return rows.map(toAdminDto);
  }

  // ---------------------------------------------------------------------
  // SPEAKER — ses opportunités (§4). Scoping EXCLUSIVEMENT via
  // resolveOwnSpeakerId (Speaker.userId = actor.id) — jamais un id fourni
  // par l'appelant pour désigner "quel speaker" (même règle que 2b/2d).
  // ---------------------------------------------------------------------

  async findOwnOpportunities(
    actor: AuthenticatedUser,
  ): Promise<AvailabilityRequestBriefingDto[]> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    const rows = await this.prisma.availabilityRequest.findMany({
      where: { speakerId },
      orderBy: { sentAt: 'desc' },
      select: AVAILABILITY_REQUEST_SELECT,
    });
    return rows.map(toBriefingDto);
  }

  async findOwnOpportunity(
    actor: AuthenticatedUser,
    id: number,
  ): Promise<AvailabilityRequestBriefingDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    const row = await this.prisma.availabilityRequest.findFirst({
      where: { id, speakerId },
      select: AVAILABILITY_REQUEST_SELECT,
    });
    // 404 générique : un id appartenant à un AUTRE speaker doit être
    // indiscernable d'un id qui n'existe pas (même règle que 2b/2d/CLAUDE.md §5,
    // même si la motivation ici est l'intégrité du scoping plutôt que le
    // grand public — un speaker A ne doit jamais savoir qu'un id "existe
    // mais n'est pas à lui").
    if (!row) {
      throw new NotFoundException(`Opportunité ${id} introuvable.`);
    }
    return toBriefingDto(row);
  }

  // §3.5 — RÉPOND, NE CONFIRME RIEN. Aucune mission n'est créée ici, aucun
  // engagement n'est pris, quelle que soit la réponse (y compris
  // AVAILABLE_INTERESTED) — la Phase 3e (missions) est hors périmètre.
  async respondToOwnOpportunity(
    actor: AuthenticatedUser,
    id: number,
    dto: RespondAvailabilityRequestDto,
  ): Promise<AvailabilityRequestBriefingDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);

    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.availabilityRequest.findFirst({
        where: { id, speakerId },
      });
      if (!existing) {
        throw new NotFoundException(`Opportunité ${id} introuvable.`);
      }
      if (existing.status !== AvailabilityRequestStatus.SENT) {
        // §3.4 — une sollicitation EXPIRED/CANCELLED (ou déjà RESPONDED) ne
        // peut plus recevoir de réponse. Message clair, jamais une erreur
        // technique brute (même exigence que pour un token expiré, §4.4).
        throw new BadRequestException(
          existing.status === AvailabilityRequestStatus.RESPONDED
            ? 'Cette opportunité a déjà reçu une réponse.'
            : `Cette opportunité n'est plus ouverte (statut : "${existing.status}") — aucune réponse possible.`,
        );
      }

      const respondedAt = new Date();
      const updated = await tx.availabilityRequest.update({
        where: { id: existing.id },
        data: {
          status: AvailabilityRequestStatus.RESPONDED,
          responseStatus: dto.status,
          respondedAt,
          speakerPrivateComment: sanitizeOptionalText(
            dto.speakerPrivateComment,
          ),
          // Terminal : libère le couple (bookingRequestId, speakerId) pour
          // une future sollicitation (§3.3).
          activeGuard: null,
        },
        select: AVAILABILITY_REQUEST_SELECT,
      });

      const newCandidateStatus = this.mapResponseToCandidateStatus(dto.status);
      await tx.bookingRequestSpeaker.updateMany({
        where: {
          requestId: existing.bookingRequestId,
          speakerId,
          deletedAt: null,
        },
        data: { status: newCandidateStatus },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'availability_request.responded',
        entityType: 'AvailabilityRequest',
        entityId: existing.id,
        oldValue: { status: existing.status },
        newValue: { status: updated.status, responseStatus: dto.status },
      });

      return updated;
    });

    // §5 — email à l'admin APRÈS le commit, jamais dedans.
    if (row.sentBy) {
      const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
      try {
        await this.mailService.sendAvailabilityResponseNotification({
          to: row.sentBy.email,
          responseStatus: dto.status,
          backOfficeUrl: `${frontendUrl}/booking-requests/${row.bookingRequestId}`,
          relatedEntityId: row.id,
        });
      } catch (error) {
        this.logger.error(
          `Échec de la notification de réponse pour availability_request #${row.id}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    return toBriefingDto(row);
  }

  // ---------------------------------------------------------------------
  // Expiration planifiée (§3.4) — appelée par RemindersScheduler, même
  // tâche horaire que la 3b (voir CLAUDE.md, limite connue : une seule
  // instance de l'app). Retourne les lignes venant d'expirer pour que
  // l'appelant notifie l'admin — cette méthode fait l'ÉCRITURE, l'envoi
  // d'email reste la responsabilité du scheduler (même découpage que
  // RemindersService/RemindersScheduler).
  // ---------------------------------------------------------------------

  async expireOverdueAndNotify(now: Date): Promise<void> {
    const overdue = await this.prisma.availabilityRequest.findMany({
      where: {
        status: AvailabilityRequestStatus.SENT,
        respondDueAt: { lt: now },
      },
      select: {
        id: true,
        bookingRequestId: true,
        sentBy: { select: { email: true } },
      },
    });
    if (overdue.length === 0) {
      return;
    }

    await this.prisma.availabilityRequest.updateMany({
      where: { id: { in: overdue.map((r) => r.id) } },
      data: { status: AvailabilityRequestStatus.EXPIRED, activeGuard: null },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    for (const request of overdue) {
      if (!request.sentBy) continue;
      try {
        await this.mailService.sendAvailabilityRequestExpired({
          to: request.sentBy.email,
          backOfficeUrl: `${frontendUrl}/booking-requests/${request.bookingRequestId}`,
          relatedEntityId: request.id,
        });
      } catch (error) {
        this.logger.error(
          `Échec de la notification d'expiration pour availability_request #${request.id}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }

  // ---------------------------------------------------------------------
  // Privé
  // ---------------------------------------------------------------------

  private mapResponseToCandidateStatus(
    status: RespondAvailabilityRequestDto['status'],
  ): BookingRequestSpeakerStatus {
    switch (status) {
      case 'AVAILABLE_INTERESTED':
        return BookingRequestSpeakerStatus.SPEAKER_AVAILABLE;
      case 'AVAILABLE_WITH_CONDITIONS':
        return BookingRequestSpeakerStatus.SPEAKER_AVAILABLE_WITH_CONDITIONS;
      case 'UNAVAILABLE':
        return BookingRequestSpeakerStatus.SPEAKER_UNAVAILABLE;
      case 'NEEDS_INFO':
        return BookingRequestSpeakerStatus.SPEAKER_NEEDS_INFO;
    }
  }

  // §2 — jamais une écriture directe : relit le statut ACTUEL puis ne
  // transitionne que si la matrice de la 3b l'autorise depuis là. Si ce
  // n'est pas le cas (ex. demande déjà CONFIRMED), ne fait rien — ce n'est
  // pas une erreur, l'envoi de la sollicitation reste un succès.
  private async tryTransitionToAwaitingSpeaker(
    bookingRequestId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const current = await this.prisma.bookingRequest.findUnique({
      where: { id: bookingRequestId },
      select: { status: true },
    });
    if (!current) return;
    if (current.status === BookingStatus.AWAITING_SPEAKER) return;
    if (
      !isBookingStatusTransitionAllowed(
        current.status,
        BookingStatus.AWAITING_SPEAKER,
      )
    ) {
      return;
    }

    // Réutilise BookingRequestsService#updateStatus TEL QUEL (validation,
    // écriture, firstRespondedAt, journalisation, hook onConfirmed) plutôt
    // que de dupliquer sa logique ici — une seule méthode qui sait écrire
    // le statut d'une demande, jamais deux.
    await this.bookingRequestsService.updateStatus(
      bookingRequestId,
      {
        status: BookingStatus.AWAITING_SPEAKER,
        comment:
          "Transition automatique : envoi d'une sollicitation de disponibilité (§2).",
      },
      actor,
    );
  }

  private isPrismaUniqueConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
