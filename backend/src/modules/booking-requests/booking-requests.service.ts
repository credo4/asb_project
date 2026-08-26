import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingRequestSource,
  BookingStatus,
  Prisma,
  Role,
  ServiceType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { MailService } from '../../mail/mail.service';
import { EmailDeliveriesService } from '../../mail/email-deliveries.service';
import { ClientLinkingService } from '../clients/client-linking.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import {
  sanitizeOptionalText,
  sanitizeText,
} from '../../common/utils/sanitize-text.util';
import { createWithUniqueReference } from '../../common/utils/reference-generator.util';
import { addBusinessDays } from './business-days.util';
import {
  CURRENT_CONSENT_VERSION,
  REQUIRE_CONSENT,
  RESPONSE_SLA_BUSINESS_DAYS,
} from './booking-request.constants';
import {
  BOOKING_REQUEST_DETAIL_INCLUDE,
  BOOKING_REQUEST_INCLUDE,
  BookingRequestRow,
} from './booking-requests.includes';
import {
  scalarSnapshot,
  toDetailDto,
  toListItemDto,
} from './mappers/booking-request.mapper';
import {
  getAllowedTransitions,
  isBookingStatusTransitionAllowed,
  isTerminalBookingStatus,
} from './booking-request-status-transitions.util';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';
import { CreateManualBookingRequestDto } from './dto/create-manual-booking-request.dto';
import { UpdateBookingRequestDto } from './dto/update-booking-request.dto';
import { UpdateBookingRequestStatusDto } from './dto/update-booking-request-status.dto';
import { AssignBookingRequestDto } from './dto/assign-booking-request.dto';
import { ReopenBookingRequestDto } from './dto/reopen-booking-request.dto';
import {
  BookingRequestSortBy,
  QueryBookingRequestsDto,
  SortOrder,
} from './dto/query-booking-requests.dto';
import { BookingRequestAckDto } from './dto/outputs/booking-request-ack.dto';
import { BookingRequestListResponseDto } from './dto/booking-request-list-item.dto';
import { BookingRequestDetailDto } from './dto/booking-request-detail.dto';
import { BookingRequestHistoryEntryDto } from './dto/outputs/booking-request-history-entry.dto';
import { LinkBookingRequestDto } from '../clients/dto/link-booking-request.dto';

const SIBLING_SELECT = {
  id: true,
  reference: true,
  serviceType: true,
  status: true,
  createdAt: true,
} satisfies Prisma.BookingRequestSelect;

@Injectable()
export class BookingRequestsService {
  private readonly logger = new Logger(BookingRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly mailService: MailService,
    private readonly emailDeliveries: EmailDeliveriesService,
    private readonly config: ConfigService,
    private readonly clientLinking: ClientLinkingService,
    private readonly appSettings: AppSettingsService,
  ) {}

  // §A4 — RESPONSE_SLA_BUSINESS_DAYS reste la source pour les 5 types de
  // service existants (décision produit explicite, voir CLAUDE.md) ; le
  // délai configuré dans app_settings ne sert QUE de repli pour un futur
  // type de service qui n'y figurerait pas encore — jamais interrogé pour
  // les 5 types actuels (court-circuit synchrone, pas de round-trip DB).
  private async resolveSlaDays(serviceType: ServiceType): Promise<number> {
    const configured = RESPONSE_SLA_BUSINESS_DAYS[serviceType];
    if (configured !== undefined) return configured;
    const settings = await this.appSettings.getEffectiveSettings();
    return settings.responseSlaBusinessDays;
  }

  // ---------------------------------------------------------------------
  // Ingestion publique (POST /public/booking-requests)
  // ---------------------------------------------------------------------

  async createFromPublic(
    dto: CreateBookingRequestDto,
  ): Promise<BookingRequestAckDto> {
    if (this.isHoneypotTriggered(dto)) {
      // Bot détecté : réponse de succès normale, mais rien n'est enregistré
      // ni envoyé — on ne renseigne jamais l'appelant sur la détection.
      return this.buildDecoyAck(dto.serviceType);
    }

    // §3 — TRANSITION DOUCE : le site public ne renvoie pas encore
    // consentGivenAt/consentVersion. Tant que REQUIRE_CONSENT vaut false, on
    // accepte quand même et on se contente de journaliser un avertissement
    // (pas un rejet 400) — voir booking-request.constants.ts pour la
    // condition de bascule.
    if (!dto.consentGivenAt && !REQUIRE_CONSENT) {
      this.logger.warn(
        `Demande publique reçue sans consentement explicite (consentGivenAt absent) — serviceType=${dto.serviceType}, email=${dto.workEmail}. Attendu tant que le nouveau formulaire public n'est pas déployé (REQUIRE_CONSENT=false).`,
      );
    } else if (!dto.consentGivenAt && REQUIRE_CONSENT) {
      throw new BadRequestException(
        'consentGivenAt est requis (REQUIRE_CONSENT est activé).',
      );
    }

    // Hors transaction (lecture seule, sans lien avec `tx`) : évite de
    // garder la transaction ouverte pour l'improbable repli app_settings
    // (voir resolveSlaDays).
    const slaDays = await this.resolveSlaDays(dto.serviceType);

    const created = await this.prisma.$transaction(async (tx) => {
      const requestedSpeakerId = await this.resolveRequestedSpeakerId(
        tx,
        dto.requestedSpeakerId,
      );
      const responseDueAt = addBusinessDays(new Date(), slaDays);
      // §A3 — rattachement automatique par email exact normalisé, SANS
      // création : un email inconnu ne doit produire AUCUNE fiche contact
      // (voir ClientLinkingService#resolveAutoLink).
      const autoLink = await this.clientLinking.resolveAutoLink(
        tx,
        dto.workEmail,
      );

      const bookingRequest = await createWithUniqueReference({
        prefix: 'ASB',
        countForYear: (year) =>
          tx.bookingRequest.count({
            where: { reference: { startsWith: `ASB-${year}-` } },
          }),
        attemptCreate: (reference) =>
          tx.bookingRequest.create({
            data: this.buildPublicCreateData(
              dto,
              reference,
              requestedSpeakerId,
              responseDueAt,
              autoLink,
            ),
            include: BOOKING_REQUEST_INCLUDE,
          }),
      });

      await this.activityLog.record(tx, {
        actorId: null,
        action: 'booking_request.created',
        entityType: 'BookingRequest',
        entityId: bookingRequest.id,
        oldValue: null,
        newValue: scalarSnapshot(bookingRequest),
      });

      return bookingRequest;
    });

    // Le dossier est déjà enregistré à ce stade : un échec d'envoi ci-dessous
    // ne doit jamais faire disparaître la demande ni faire échouer la requête
    // HTTP (cf. §6 du cahier des charges).
    await this.sendNotifications(created);

    return {
      reference: created.reference,
      message: this.buildAckMessage(created.serviceType),
    };
  }

  // POST /admin/booking-requests (§3) — « sollicitations reçues par
  // téléphone ou en personne ». source = MANUAL_ENTRY forcé, pas de
  // honeypot (l'appelant est authentifié ADMIN/SUPER_ADMIN), pas d'email
  // d'accusé de réception au "client" (ce n'est pas une soumission de sa
  // part) — seule la notification d'assignation (le cas échéant) s'applique.
  async createManual(
    dto: CreateManualBookingRequestDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestDetailDto> {
    const slaDays = await this.resolveSlaDays(dto.serviceType);

    const created = await this.prisma.$transaction(async (tx) => {
      const requestedSpeakerId = await this.resolveRequestedSpeakerId(
        tx,
        dto.requestedSpeakerId,
      );
      if (dto.assignedAdminId !== undefined) {
        await this.assertAdminExists(tx, dto.assignedAdminId);
      }
      const responseDueAt = addBusinessDays(new Date(), slaDays);
      const autoLink = await this.clientLinking.resolveAutoLink(
        tx,
        dto.workEmail,
      );
      const gdprConsent = dto.gdprConsent ?? false;

      const bookingRequest = await createWithUniqueReference({
        prefix: 'ASB',
        countForYear: (year) =>
          tx.bookingRequest.count({
            where: { reference: { startsWith: `ASB-${year}-` } },
          }),
        attemptCreate: (reference) =>
          tx.bookingRequest.create({
            data: {
              reference,
              serviceType: dto.serviceType,
              fullName: sanitizeText(dto.fullName),
              organization: sanitizeText(dto.organization),
              jobTitle: sanitizeOptionalText(dto.jobTitle),
              workEmail: dto.workEmail,
              phone: sanitizeOptionalText(dto.phone),
              eventName: sanitizeOptionalText(dto.eventName),
              eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
              eventLocation: sanitizeOptionalText(dto.eventLocation),
              eventFormat: sanitizeOptionalText(dto.eventFormat),
              audienceSize: sanitizeOptionalText(dto.audienceSize),
              primaryTopics: sanitizeOptionalText(dto.primaryTopics),
              goals: sanitizeOptionalText(dto.goals),
              estimatedBudget: sanitizeOptionalText(dto.estimatedBudget),
              additionalComments: sanitizeOptionalText(dto.additionalComments),
              visitPurpose: dto.visitPurpose,
              requestedSpeakerId,
              assignedAdminId: dto.assignedAdminId,
              contactId: autoLink.contactId,
              organizationId: autoLink.organizationId,
              source: BookingRequestSource.MANUAL_ENTRY,
              gdprConsent,
              // Consentement verbal déclaré par l'admin (pas une case cochée
              // par le prospect) : on l'horodate quand même, avec la
              // version de politique en vigueur.
              consentGivenAt: gdprConsent ? new Date() : undefined,
              consentVersion: gdprConsent ? CURRENT_CONSENT_VERSION : undefined,
              responseDueAt,
            },
            include: BOOKING_REQUEST_INCLUDE,
          }),
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request.created_manually',
        entityType: 'BookingRequest',
        entityId: bookingRequest.id,
        oldValue: null,
        newValue: scalarSnapshot(bookingRequest),
      });

      return bookingRequest;
    });

    if (created.assignedAdminId) {
      await this.notifyAssignment(created);
    }

    return this.findOne(created.id);
  }

  private isHoneypotTriggered(dto: CreateBookingRequestDto): boolean {
    return typeof dto.website2 === 'string' && dto.website2.trim().length > 0;
  }

  private buildDecoyAck(
    serviceType: CreateBookingRequestDto['serviceType'],
  ): BookingRequestAckDto {
    const year = new Date().getFullYear();
    const fakeSequence = Math.floor(100000 + Math.random() * 900000);
    return {
      reference: `ASB-${year}-${fakeSequence}`,
      message: this.buildAckMessage(serviceType),
    };
  }

  private buildAckMessage(
    serviceType: CreateBookingRequestDto['serviceType'],
  ): string {
    const days = RESPONSE_SLA_BUSINESS_DAYS[serviceType];
    const plural = days > 1 ? 's' : '';
    return `Merci pour votre demande. Notre équipe vous répondra sous ${days} jour${plural} ouvré${plural}.`;
  }

  private async resolveRequestedSpeakerId(
    tx: Prisma.TransactionClient,
    requestedSpeakerId: number | undefined,
  ): Promise<number | undefined> {
    if (!requestedSpeakerId) {
      return undefined;
    }
    // Mêmes conditions que l'invariant public/privé (CLAUDE.md §5), vérifiées
    // ici indépendamment plutôt que de faire dépendre ce module de
    // modules/public — un speaker "demandable" via "Check Availability" doit
    // être publié et visible.
    const speaker = await tx.speaker.findFirst({
      where: {
        id: requestedSpeakerId,
        status: 'PUBLISHED',
        isVisible: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    // Référence invalide/non publiée : ignorée silencieusement plutôt que de
    // faire échouer toute la soumission (cf. §3).
    return speaker?.id;
  }

  private async assertAdminExists(
    tx: Prisma.TransactionClient,
    adminId: number,
  ): Promise<void> {
    const admin = await tx.user.findFirst({
      where: { id: adminId, role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
      select: { id: true },
    });
    if (!admin) {
      throw new BadRequestException(
        `Utilisateur ${adminId} introuvable ou non habilité (ADMIN/SUPER_ADMIN).`,
      );
    }
  }

  private buildPublicCreateData(
    dto: CreateBookingRequestDto,
    reference: string,
    requestedSpeakerId: number | undefined,
    responseDueAt: Date,
    autoLink: { contactId?: number; organizationId?: number },
  ): Prisma.BookingRequestUncheckedCreateInput {
    return {
      reference,
      serviceType: dto.serviceType,
      fullName: sanitizeText(dto.fullName),
      organization: sanitizeText(dto.organization),
      jobTitle: sanitizeOptionalText(dto.jobTitle),
      workEmail: dto.workEmail,
      phone: sanitizeOptionalText(dto.phone),
      websiteOrLinkedin: sanitizeOptionalText(dto.websiteOrLinkedin),
      eventName: sanitizeOptionalText(dto.eventName),
      eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
      eventLocation: sanitizeOptionalText(dto.eventLocation),
      eventFormat: sanitizeOptionalText(dto.eventFormat),
      audienceSize: sanitizeOptionalText(dto.audienceSize),
      sessionLength: sanitizeOptionalText(dto.sessionLength),
      language: sanitizeOptionalText(dto.language),
      primaryTopics: sanitizeOptionalText(dto.primaryTopics),
      goals: sanitizeOptionalText(dto.goals),
      speakerPreferences: sanitizeOptionalText(dto.speakerPreferences),
      estimatedBudget: sanitizeOptionalText(dto.estimatedBudget),
      additionalComments: sanitizeOptionalText(dto.additionalComments),
      visitPurpose: dto.visitPurpose,
      keyQuestions: sanitizeOptionalText(dto.keyQuestions),
      preferredTime: sanitizeOptionalText(dto.preferredTime),
      requestedSpeakerId,
      contactId: autoLink.contactId,
      organizationId: autoLink.organizationId,
      source: BookingRequestSource.PUBLIC_FORM,
      gdprConsent: dto.gdprConsent,
      consentGivenAt: dto.consentGivenAt
        ? new Date(dto.consentGivenAt)
        : undefined,
      consentVersion: dto.consentVersion,
      responseDueAt,
    };
  }

  private async sendNotifications(
    bookingRequest: BookingRequestRow,
  ): Promise<void> {
    // §A4 — app_settings.teamEmail d'abord, ASB_TEAM_EMAIL (.env) en repli
    // (voir AppSettingsService#getEffectiveSettings).
    const teamEmail = (await this.appSettings.getEffectiveSettings()).teamEmail;
    const frontendUrl = this.config.get<string>('FRONTEND_URL');

    if (teamEmail) {
      try {
        await this.mailService.sendBookingRequestTeamNotification({
          to: teamEmail,
          reference: bookingRequest.reference,
          serviceType: bookingRequest.serviceType,
          fullName: bookingRequest.fullName,
          organization: bookingRequest.organization ?? '',
          workEmail: bookingRequest.workEmail,
          summary: bookingRequest.goals ?? bookingRequest.primaryTopics ?? '',
          // Route de back-office supposée (pas encore scaffoldé — cf.
          // CLAUDE.md §2) : à ajuster une fois le routing réel connu.
          backOfficeUrl: `${frontendUrl ?? ''}/booking-requests/${bookingRequest.id}`,
          relatedEntityId: bookingRequest.id,
        });
      } catch (error) {
        this.logger.error(
          `Échec de la notification interne pour ${bookingRequest.reference}`,
          error instanceof Error ? error.stack : error,
        );
      }
    } else {
      this.logger.warn(
        "Email d'équipe absent (ni app_settings.teamEmail, ni ASB_TEAM_EMAIL) : notification interne non envoyée.",
      );
    }

    try {
      await this.mailService.sendBookingRequestAcknowledgment({
        to: bookingRequest.workEmail,
        fullName: bookingRequest.fullName,
        reference: bookingRequest.reference,
        responseDays: RESPONSE_SLA_BUSINESS_DAYS[bookingRequest.serviceType],
        relatedEntityId: bookingRequest.id,
      });
    } catch (error) {
      this.logger.error(
        `Échec de l'accusé de réception pour ${bookingRequest.reference}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  // §5 — seule notification "gestion interne" de cette étape : un email à
  // l'admin lorsqu'une demande lui est assignée. Échec non bloquant (même
  // philosophie que sendNotifications ci-dessus).
  private async notifyAssignment(
    bookingRequest: BookingRequestRow,
  ): Promise<void> {
    if (!bookingRequest.assignedAdmin) return;
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    try {
      await this.mailService.sendBookingRequestAssigned({
        to: bookingRequest.assignedAdmin.email,
        reference: bookingRequest.reference,
        fullName: bookingRequest.fullName,
        organization: bookingRequest.organization ?? '',
        backOfficeUrl: `${frontendUrl ?? ''}/booking-requests/${bookingRequest.id}`,
        relatedEntityId: bookingRequest.id,
      });
    } catch (error) {
      this.logger.error(
        `Échec de l'email d'assignation pour ${bookingRequest.reference}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  // ---------------------------------------------------------------------
  // Inbox admin
  // ---------------------------------------------------------------------

  async findAll(
    query: QueryBookingRequestsDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where = this.buildWhere(query, actor);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.bookingRequest.count({ where }),
      this.prisma.bookingRequest.findMany({
        where,
        orderBy: this.buildOrderBy(query),
        skip: (page - 1) * perPage,
        take: perPage,
        include: BOOKING_REQUEST_INCLUDE,
      }),
    ]);

    return {
      data: rows.map(toListItemDto),
      meta: { total, page, perPage },
    };
  }

  async findOne(id: number): Promise<BookingRequestDetailDto> {
    const row = await this.prisma.bookingRequest.findUnique({
      where: { id },
      include: BOOKING_REQUEST_DETAIL_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Demande ${id} introuvable.`);
    }

    // §6.2 — historique des autres demandes du même contact/de la même
    // organisation, EXCLUT la demande courante. Pas de relation directe côté
    // Prisma (ce sont d'AUTRES lignes de la même table) — deux requêtes
    // légères, exécutées en parallèle.
    const [fromContact, fromOrganization, emailDeliveries] = await Promise.all([
      row.contactId
        ? this.prisma.bookingRequest.findMany({
            where: { contactId: row.contactId, id: { not: id } },
            orderBy: { createdAt: 'desc' },
            select: SIBLING_SELECT,
          })
        : Promise.resolve([]),
      row.organizationId
        ? this.prisma.bookingRequest.findMany({
            where: { organizationId: row.organizationId, id: { not: id } },
            orderBy: { createdAt: 'desc' },
            select: SIBLING_SELECT,
          })
        : Promise.resolve([]),
      // §E (consolidation) — voir EmailDeliverySummaryDto pour le choix de
      // renvoyer l'historique complet plutôt que le seul dernier envoi.
      this.emailDeliveries.findForEntity('BookingRequest', id),
    ]);

    return toDetailDto(row, { fromContact, fromOrganization }, emailDeliveries);
  }

  // GET /admin/booking-requests/:id/history (§2.7) — flux unique trié,
  // directement depuis activity_logs : toutes les actions pertinentes
  // (création, statut, assignation, notes, pièces jointes, réouverture,
  // rattachement) journalisent DÉJÀ avec entityType='BookingRequest',
  // entityId=:id — pas besoin d'agréger plusieurs sources.
  async getHistory(id: number): Promise<BookingRequestHistoryEntryDto[]> {
    const exists = await this.prisma.bookingRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Demande ${id} introuvable.`);
    }

    const rows = await this.prisma.activityLog.findMany({
      where: { entityType: 'BookingRequest', entityId: id },
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
    dto: UpdateBookingRequestDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookingRequest.findUnique({
        where: { id },
        include: BOOKING_REQUEST_INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException(`Demande ${id} introuvable.`);
      }

      const data: Prisma.BookingRequestUncheckedUpdateInput = {};
      if (dto.priority !== undefined) data.priority = dto.priority;

      const bookingRequest = await tx.bookingRequest.update({
        where: { id },
        data,
        include: BOOKING_REQUEST_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request.updated',
        entityType: 'BookingRequest',
        entityId: id,
        oldValue: scalarSnapshot(existing),
        newValue: scalarSnapshot(bookingRequest),
      });
    });

    return this.findOne(id);
  }

  // ---------------------------------------------------------------------
  // Machine à états (§1) — PATCH /admin/booking-requests/:id/status.
  // ---------------------------------------------------------------------

  async updateStatus(
    id: number,
    dto: UpdateBookingRequestStatusDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookingRequest.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Demande ${id} introuvable.`);
      }

      if (!isBookingStatusTransitionAllowed(existing.status, dto.status)) {
        const allowed = getAllowedTransitions(existing.status);
        const allowedList =
          allowed.length > 0
            ? allowed.join(', ')
            : '(aucune — statut terminal)';
        throw new BadRequestException(
          `Transition de statut refusée : "${existing.status}" -> "${dto.status}". Transitions possibles depuis "${existing.status}" : ${allowedList}.`,
        );
      }

      // §2.5 — première réponse : la PREMIÈRE transition qui sort de NEW.
      const firstRespondedAt =
        existing.firstRespondedAt === null &&
        existing.status === BookingStatus.NEW &&
        dto.status !== BookingStatus.NEW
          ? new Date()
          : undefined;

      const bookingRequest = await tx.bookingRequest.update({
        where: { id },
        data: { status: dto.status, firstRespondedAt },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request.status_changed',
        entityType: 'BookingRequest',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: bookingRequest.status, comment: dto.comment },
      });

      // §1 — CONFIRMED reste le signal identifiable pour la création de
      // mission, mais volontairement PAS câblé automatiquement ici : la
      // Phase 3e (missions), une fois écrite, a explicitement exigé une
      // action ADMIN EXPLICITE (POST /admin/booking-requests/:id/missions),
      // "jamais un effet de bord automatique d'un changement de statut" —
      // créer une mission dans CE hook aurait été exactement le second
      // chemin que ce commentaire avait pour but d'éviter. Le hook reste un
      // point d'extension délibérément no-op (utile si un futur besoin
      // ATTENDU comme effet de bord automatique de CONFIRMED apparaît un
      // jour — aucun aujourd'hui), pas un déclencheur de mission.
      if (dto.status === BookingStatus.CONFIRMED) {
        await this.onConfirmed(bookingRequest, tx);
      }
    });

    return this.findOne(id);
  }

  // Volontairement vide — voir le commentaire ci-dessus. MissionsService#create
  // est le SEUL chemin de création de mission (§1, Phase 3e), déclenché par
  // une action admin explicite, jamais par ce hook.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async onConfirmed(
    bookingRequest: { id: number },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    // no-op — voir le commentaire ci-dessus.
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  // PATCH /admin/booking-requests/:id/reopen — réservé SUPER_ADMIN (voir
  // @Roles sur le contrôleur). Seule façon de sortir un statut terminal.
  async reopen(
    id: number,
    dto: ReopenBookingRequestDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestDetailDto> {
    if (isTerminalBookingStatus(dto.targetStatus)) {
      throw new BadRequestException(
        `targetStatus ne peut pas être un statut terminal ("${dto.targetStatus}").`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookingRequest.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Demande ${id} introuvable.`);
      }
      if (!isTerminalBookingStatus(existing.status)) {
        throw new BadRequestException(
          `La demande n'est pas dans un statut terminal ("${existing.status}") — utilise PATCH .../status pour une transition normale.`,
        );
      }

      const bookingRequest = await tx.bookingRequest.update({
        where: { id },
        data: { status: dto.targetStatus },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request.reopened',
        entityType: 'BookingRequest',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: bookingRequest.status, comment: dto.comment },
      });
    });

    return this.findOne(id);
  }

  // ---------------------------------------------------------------------
  // Assignation (§2.1) — PATCH /admin/booking-requests/:id/assign.
  // ---------------------------------------------------------------------

  async assign(
    id: number,
    dto: AssignBookingRequestDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestDetailDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookingRequest.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Demande ${id} introuvable.`);
      }
      if (dto.assignedAdminId !== null) {
        await this.assertAdminExists(tx, dto.assignedAdminId);
      }

      const bookingRequest = await tx.bookingRequest.update({
        where: { id },
        data: { assignedAdminId: dto.assignedAdminId },
        include: BOOKING_REQUEST_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request.assigned',
        entityType: 'BookingRequest',
        entityId: id,
        oldValue: { assignedAdminId: existing.assignedAdminId },
        newValue: { assignedAdminId: bookingRequest.assignedAdminId },
      });

      return bookingRequest;
    });

    if (updated.assignedAdminId) {
      await this.notifyAssignment(updated);
    }

    return this.findOne(id);
  }

  // ---------------------------------------------------------------------
  // §2.5 — première réponse : partagé avec BookingRequestNotesService (la
  // première note interne compte aussi comme "première réponse", au même
  // titre que la première transition hors NEW — voir updateStatus ci-dessus,
  // le premier des deux événements l'emporte).
  // ---------------------------------------------------------------------

  async markFirstRespondedIfNeeded(
    tx: Prisma.TransactionClient,
    requestId: number,
  ): Promise<void> {
    const existing = await tx.bookingRequest.findUnique({
      where: { id: requestId },
      select: { firstRespondedAt: true },
    });
    if (existing && existing.firstRespondedAt === null) {
      await tx.bookingRequest.update({
        where: { id: requestId },
        data: { firstRespondedAt: new Date() },
      });
    }
  }

  // PATCH /admin/booking-requests/:id/link (§A5) — « convertir en fiche
  // client » : rattache à un contact/une organisation existants, ou en crée
  // un à partir des données d'intake. Les champs d'intake d'origine
  // (fullName/workEmail/organization...) ne sont JAMAIS modifiés ici — voir
  // CLAUDE.md et ClientLinkingService.
  async link(
    id: number,
    dto: LinkBookingRequestDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestDetailDto> {
    if (
      dto.contactId === undefined &&
      dto.organizationId === undefined &&
      !dto.createContactFromIntake &&
      !dto.createOrganizationFromIntake
    ) {
      throw new BadRequestException(
        'Fournis au moins un de : contactId, organizationId, createContactFromIntake, createOrganizationFromIntake.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookingRequest.findUnique({
        where: { id },
        include: BOOKING_REQUEST_INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException(`Demande ${id} introuvable.`);
      }

      // Organisation résolue AVANT le contact : un contact nouvellement créé
      // à partir de l'intake peut être rattaché à l'organisation qu'on vient
      // de résoudre/créer sur cette même requête.
      let organizationId = existing.organizationId ?? undefined;
      if (dto.organizationId !== undefined) {
        organizationId = await this.clientLinking.assertOrganizationExists(
          tx,
          dto.organizationId,
        );
      } else if (dto.createOrganizationFromIntake) {
        organizationId = await this.clientLinking.createOrganizationFromIntake(
          tx,
          existing.organization,
          actor,
        );
      }

      let contactId = existing.contactId ?? undefined;
      if (dto.contactId !== undefined) {
        contactId = await this.clientLinking.assertContactExists(
          tx,
          dto.contactId,
        );
      } else if (dto.createContactFromIntake) {
        contactId = await this.clientLinking.createContactFromIntake(
          tx,
          {
            fullName: existing.fullName,
            workEmail: existing.workEmail,
            phone: existing.phone,
            jobTitle: existing.jobTitle,
          },
          organizationId,
          actor,
        );
      }

      const bookingRequest = await tx.bookingRequest.update({
        where: { id },
        data: { contactId, organizationId },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request.linked',
        entityType: 'BookingRequest',
        entityId: id,
        oldValue: {
          contactId: existing.contactId,
          organizationId: existing.organizationId,
        },
        newValue: {
          contactId: bookingRequest.contactId,
          organizationId: bookingRequest.organizationId,
        },
      });
    });

    return this.findOne(id);
  }

  private buildWhere(
    query: QueryBookingRequestsDto,
    actor: AuthenticatedUser,
  ): Prisma.BookingRequestWhereInput {
    const conditions: Prisma.BookingRequestWhereInput[] = [];

    if (query.serviceType) conditions.push({ serviceType: query.serviceType });
    if (query.status) conditions.push({ status: query.status });
    if (query.priority) conditions.push({ priority: query.priority });
    // "Mes demandes" (§2.1) : résolu contre l'acteur authentifié, jamais un
    // id fourni par l'appelant — ignore query.assignedAdminId s'il est
    // fourni en même temps.
    if (query.mine) {
      conditions.push({ assignedAdminId: actor.id });
    } else if (query.assignedAdminId) {
      conditions.push({ assignedAdminId: query.assignedAdminId });
    }
    if (query.organizationId) {
      conditions.push({ organizationId: query.organizationId });
    }
    if (query.search) {
      const search = query.search;
      conditions.push({
        OR: [
          { fullName: { contains: search } },
          { organization: { contains: search } },
          { workEmail: { contains: search } },
          { reference: { contains: search } },
        ],
      });
    }
    if (query.dateFrom || query.dateTo) {
      conditions.push({
        createdAt: {
          ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
          ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
        },
      });
    }
    // isOverdue (§2.5) : responseDueAt dépassé ET aucune première réponse.
    if (query.overdue) {
      conditions.push({
        responseDueAt: { lt: new Date() },
        firstRespondedAt: null,
      });
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private buildOrderBy(
    query: QueryBookingRequestsDto,
  ): Prisma.BookingRequestOrderByWithRelationInput[] {
    const order = query.sortOrder ?? SortOrder.DESC;
    switch (query.sortBy) {
      case BookingRequestSortBy.EVENT_DATE:
        return [{ eventDate: order }];
      case BookingRequestSortBy.PRIORITY:
        return [{ priority: order }];
      case BookingRequestSortBy.RESPONSE_DUE_AT:
        return [{ responseDueAt: order }];
      case BookingRequestSortBy.RECEIVED_AT:
      default:
        return [{ createdAt: order }];
    }
  }
}
