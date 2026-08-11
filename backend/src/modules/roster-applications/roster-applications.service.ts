import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import {
  ApplicationStatus,
  Prisma,
  Role,
  SpeakerStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { MailService } from '../../mail/mail.service';
import { EmailDeliveriesService } from '../../mail/email-deliveries.service';
import {
  AuthService,
  BCRYPT_COST_FACTOR,
  TokenPair,
} from '../auth/auth.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import {
  sanitizeOptionalText,
  sanitizeText,
} from '../../common/utils/sanitize-text.util';
import { createWithUniqueReference } from '../../common/utils/reference-generator.util';
import { resolveUniqueSlug } from '../speakers/slug.util';
import {
  CONVERSION_TRANSACTION_TIMEOUT_MS,
  CURRENT_TERMS_VERSION,
  DEFAULT_INVITATION_TOKEN_TTL_DAYS,
} from './roster-application.constants';
import {
  ROSTER_APPLICATION_DETAIL_INCLUDE,
  ROSTER_APPLICATION_INCLUDE,
  ROSTER_APPLICATION_LIST_INCLUDE,
  RosterApplicationRow,
} from './roster-applications.includes';
import {
  scalarSnapshot,
  toDetailDto,
  toListItemDto,
} from './mappers/roster-application.mapper';
import { computeAggregatedScore } from './aggregated-score.util';
import {
  getAllowedApplicationTransitions,
  isApplicationReopenable,
  isApplicationStatusTransitionAllowed,
  isTerminalApplicationStatus,
} from './roster-application-status-transitions.util';
import { CreateRosterApplicationDto } from './dto/create-roster-application.dto';
import { QueryRosterApplicationsDto } from './dto/query-roster-applications.dto';
import { UpdateRosterApplicationStatusDto } from './dto/update-roster-application-status.dto';
import { AssignRosterApplicationDto } from './dto/assign-roster-application.dto';
import { ReopenRosterApplicationDto } from './dto/reopen-roster-application.dto';
import { RequestInfoDto } from './dto/request-info.dto';
import { RejectRosterApplicationDto } from './dto/reject-roster-application.dto';
import { AttachExistingUserDto } from './dto/attach-existing-user.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { RosterApplicationAckDto } from './dto/outputs/roster-application-ack.dto';
import { RosterApplicationListResponseDto } from './dto/roster-application-list-item.dto';
import { RosterApplicationDetailDto } from './dto/roster-application-detail.dto';
import { RosterApplicationHistoryEntryDto } from './dto/outputs/history-entry.dto';
import { ConversionResultDto } from './dto/outputs/conversion-result.dto';

const ACK_MESSAGE =
  'Merci pour votre candidature. Notre équipe reviendra vers vous prochainement.';

@Injectable()
export class RosterApplicationsService {
  private readonly logger = new Logger(RosterApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly mailService: MailService,
    private readonly emailDeliveries: EmailDeliveriesService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  // ---------------------------------------------------------------------
  // Ingestion publique (POST /public/roster-applications) — inchangé depuis
  // la Phase 1, hors renommage de type d'import.
  // ---------------------------------------------------------------------

  async createFromPublic(
    dto: CreateRosterApplicationDto,
  ): Promise<RosterApplicationAckDto> {
    if (this.isHoneypotTriggered(dto)) {
      return this.buildDecoyAck();
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const application = await createWithUniqueReference({
        prefix: 'APP',
        countForYear: (year) =>
          tx.rosterApplication.count({
            where: { reference: { startsWith: `APP-${year}-` } },
          }),
        attemptCreate: (reference) =>
          tx.rosterApplication.create({
            data: this.buildCreateData(dto, reference),
            include: ROSTER_APPLICATION_INCLUDE,
          }),
      });

      await this.activityLog.record(tx, {
        actorId: null,
        action: 'roster_application.created',
        entityType: 'RosterApplication',
        entityId: application.id,
        oldValue: null,
        newValue: scalarSnapshot(application),
      });

      return application;
    });

    await this.sendNotifications(created);

    return { reference: created.reference, message: ACK_MESSAGE };
  }

  private isHoneypotTriggered(dto: CreateRosterApplicationDto): boolean {
    return typeof dto.website2 === 'string' && dto.website2.trim().length > 0;
  }

  private buildDecoyAck(): RosterApplicationAckDto {
    const year = new Date().getFullYear();
    const fakeSequence = Math.floor(100000 + Math.random() * 900000);
    return { reference: `APP-${year}-${fakeSequence}`, message: ACK_MESSAGE };
  }

  private buildCreateData(
    dto: CreateRosterApplicationDto,
    reference: string,
  ): Prisma.RosterApplicationUncheckedCreateInput {
    return {
      reference,
      fullName: sanitizeText(dto.fullName),
      jobTitle: sanitizeOptionalText(dto.jobTitle),
      organization: sanitizeOptionalText(dto.organization),
      country: sanitizeOptionalText(dto.country),
      workEmail: dto.workEmail,
      phone: sanitizeOptionalText(dto.phone),
      linkedinUrl: dto.linkedinUrl,
      expertiseArea: sanitizeOptionalText(dto.expertiseArea),
      keyTopics: sanitizeOptionalText(dto.keyTopics),
      message: sanitizeOptionalText(dto.message),
      gdprConsent: dto.gdprConsent,
    };
  }

  private async sendNotifications(
    application: RosterApplicationRow,
  ): Promise<void> {
    const teamEmail = this.config.get<string>('ASB_TEAM_EMAIL');
    const frontendUrl = this.config.get<string>('FRONTEND_URL');

    if (teamEmail) {
      try {
        await this.mailService.sendRosterApplicationTeamNotification({
          to: teamEmail,
          reference: application.reference,
          fullName: application.fullName,
          organization: application.organization,
          workEmail: application.workEmail,
          expertiseArea: application.expertiseArea,
          backOfficeUrl: `${frontendUrl ?? ''}/roster-applications/${application.id}`,
          relatedEntityId: application.id,
        });
      } catch (error) {
        this.logger.error(
          `Échec de la notification interne pour ${application.reference}`,
          error instanceof Error ? error.stack : error,
        );
      }
    } else {
      this.logger.warn(
        'ASB_TEAM_EMAIL absent : notification interne non envoyée.',
      );
    }

    try {
      await this.mailService.sendRosterApplicationAcknowledgment({
        to: application.workEmail,
        fullName: application.fullName,
        reference: application.reference,
        relatedEntityId: application.id,
      });
    } catch (error) {
      this.logger.error(
        `Échec de l'accusé de réception pour ${application.reference}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  // ---------------------------------------------------------------------
  // Inbox admin — liste (§5.1) et détail (§5.2)
  // ---------------------------------------------------------------------

  async findAll(
    query: QueryRosterApplicationsDto,
  ): Promise<RosterApplicationListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where = this.buildWhere(query);

    // `minScore` porte sur un score AGRÉGÉ calculé à la lecture (jamais
    // stocké — voir aggregated-score.util.ts) : impossible à pousser dans la
    // clause WHERE SQL sans dénormaliser. Quand ce filtre est actif, on
    // bascule sur un post-filtrage en mémoire (fetch de tout l'ensemble déjà
    // filtré par les AUTRES critères, filtre + pagination faits ici) —
    // acceptable pour le volume d'une inbox de candidatures admin ; à
    // revisiter (ex. vue matérialisée) si ce volume devenait significatif.
    if (query.minScore !== undefined) {
      const allRows = await this.prisma.rosterApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: ROSTER_APPLICATION_LIST_INCLUDE,
      });
      const minScore = query.minScore;
      const filtered = allRows.filter((row) => {
        const score = computeAggregatedScore(row.evaluations);
        return score !== null && score >= minScore;
      });
      const total = filtered.length;
      const pageRows = filtered.slice(
        (page - 1) * perPage,
        (page - 1) * perPage + perPage,
      );
      const duplicateEmails = await this.computeDuplicateEmailFlags(
        pageRows.map((r) => r.workEmail),
      );

      return {
        data: pageRows.map((row) =>
          toListItemDto(row, duplicateEmails.has(row.workEmail.toLowerCase())),
        ),
        meta: { total, page, perPage },
      };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.rosterApplication.count({ where }),
      this.prisma.rosterApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: ROSTER_APPLICATION_LIST_INCLUDE,
      }),
    ]);

    const duplicateEmails = await this.computeDuplicateEmailFlags(
      rows.map((r) => r.workEmail),
    );

    return {
      data: rows.map((row) =>
        toListItemDto(row, duplicateEmails.has(row.workEmail.toLowerCase())),
      ),
      meta: { total, page, perPage },
    };
  }

  async findOne(id: number): Promise<RosterApplicationDetailDto> {
    const row = await this.prisma.rosterApplication.findUnique({
      where: { id },
      include: ROSTER_APPLICATION_DETAIL_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Candidature ${id} introuvable.`);
    }

    const [duplicateEmails, emailDeliveries] = await Promise.all([
      this.computeDuplicateEmailFlags([row.workEmail]),
      // §E (consolidation) — voir EmailDeliverySummaryDto.
      this.emailDeliveries.findForEntity('RosterApplication', id),
    ]);

    return toDetailDto(
      row,
      duplicateEmails.has(row.workEmail.toLowerCase()),
      emailDeliveries,
    );
  }

  // GET /admin/roster-applications/:id/history — même principe que
  // BookingRequestsService#getHistory (Phase 3b) : projection directe
  // d'activity_logs, aucune agrégation multi-source nécessaire.
  async getHistory(id: number): Promise<RosterApplicationHistoryEntryDto[]> {
    const exists = await this.prisma.rosterApplication.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Candidature ${id} introuvable.`);
    }

    const rows = await this.prisma.activityLog.findMany({
      where: { entityType: 'RosterApplication', entityId: id },
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

  // §5.1 — signale (ne bloque pas) : email partagé avec une AUTRE candidature
  // déjà en base, ou avec un speaker existant. Opère sur la page courante
  // (ou l'ensemble filtré si minScore actif) : un simple signal admin, pas
  // une vérité absolue nécessitant un balayage complet à chaque lecture.
  private async computeDuplicateEmailFlags(
    workEmails: string[],
  ): Promise<Set<string>> {
    if (workEmails.length === 0) {
      return new Set();
    }
    const emails = [...new Set(workEmails)];

    const [siblingGroups, speakerMatches] = await Promise.all([
      this.prisma.rosterApplication.groupBy({
        by: ['workEmail'],
        where: { workEmail: { in: emails } },
        _count: { _all: true },
      }),
      this.prisma.speaker.findMany({
        where: { email: { in: emails }, deletedAt: null },
        select: { email: true },
      }),
    ]);

    const flagged = new Set<string>();
    for (const group of siblingGroups) {
      if (group._count._all > 1) {
        flagged.add(group.workEmail.toLowerCase());
      }
    }
    for (const speaker of speakerMatches) {
      if (speaker.email) {
        flagged.add(speaker.email.toLowerCase());
      }
    }
    return flagged;
  }

  private buildWhere(
    query: QueryRosterApplicationsDto,
  ): Prisma.RosterApplicationWhereInput {
    const conditions: Prisma.RosterApplicationWhereInput[] = [];

    if (query.status) conditions.push({ status: query.status });
    if (query.country) {
      conditions.push({ country: { contains: query.country } });
    }
    if (query.assignedAdminId) {
      conditions.push({ assignedAdminId: query.assignedAdminId });
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

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  // ---------------------------------------------------------------------
  // Machine à états (§1) — PATCH /admin/roster-applications/:id/status.
  // ---------------------------------------------------------------------

  async updateStatus(
    id: number,
    dto: UpdateRosterApplicationStatusDto,
    actor: AuthenticatedUser,
  ): Promise<RosterApplicationDetailDto> {
    // Trois cibles ont leur propre endpoint dédié (effets de bord que ce DTO
    // générique ne porte pas) — voir le commentaire sur
    // UpdateRosterApplicationStatusDto.
    if (dto.status === ApplicationStatus.CONVERTED) {
      throw new BadRequestException(
        "CONVERTED n'est atteignable que via POST .../convert — jamais par un changement de statut manuel.",
      );
    }
    if (dto.status === ApplicationStatus.INFO_REQUESTED) {
      throw new BadRequestException(
        'Utilisez POST .../request-info pour passer en INFO_REQUESTED (message au candidat requis).',
      );
    }
    if (dto.status === ApplicationStatus.REJECTED) {
      throw new BadRequestException(
        'Utilisez POST .../reject pour passer en REJECTED (motif requis).',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.rosterApplication.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Candidature ${id} introuvable.`);
      }

      if (!isApplicationStatusTransitionAllowed(existing.status, dto.status)) {
        const allowed = getAllowedApplicationTransitions(existing.status);
        const allowedList =
          allowed.length > 0
            ? allowed.join(', ')
            : '(aucune — statut terminal)';
        throw new BadRequestException(
          `Transition de statut refusée : "${existing.status}" -> "${dto.status}". Transitions possibles depuis "${existing.status}" : ${allowedList}.`,
        );
      }

      const data: Prisma.RosterApplicationUncheckedUpdateInput = {
        status: dto.status,
        statusChangedAt: new Date(),
      };
      if (
        dto.status === ApplicationStatus.INTERVIEW_TO_SCHEDULE &&
        dto.interviewScheduledAt
      ) {
        data.interviewScheduledAt = new Date(dto.interviewScheduledAt);
      }
      if (
        dto.status === ApplicationStatus.INTERVIEW_DONE &&
        dto.interviewNotes !== undefined
      ) {
        data.interviewNotes = sanitizeOptionalText(dto.interviewNotes);
      }

      const updated = await tx.rosterApplication.update({
        where: { id },
        data,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'roster_application.status_changed',
        entityType: 'RosterApplication',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: updated.status, comment: dto.comment },
      });
    });

    return this.findOne(id);
  }

  // PATCH /admin/roster-applications/:id/reopen — réservé SUPER_ADMIN (voir
  // @Roles sur le contrôleur). CONVERTED est terminal mais N'EST PAS
  // réouvrable (isApplicationReopenable l'exclut) : on ne "déconvertit"
  // jamais un candidat qui a déjà un compte speaker réel.
  async reopen(
    id: number,
    dto: ReopenRosterApplicationDto,
    actor: AuthenticatedUser,
  ): Promise<RosterApplicationDetailDto> {
    if (isTerminalApplicationStatus(dto.targetStatus)) {
      throw new BadRequestException(
        `targetStatus ne peut pas être un statut terminal ("${dto.targetStatus}").`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.rosterApplication.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Candidature ${id} introuvable.`);
      }
      if (!isApplicationReopenable(existing.status)) {
        throw new BadRequestException(
          `La candidature n'est pas dans un statut réouvrable ("${existing.status}") — REJECTED et ARCHIVED uniquement (jamais CONVERTED).`,
        );
      }

      const updated = await tx.rosterApplication.update({
        where: { id },
        data: { status: dto.targetStatus, statusChangedAt: new Date() },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'roster_application.reopened',
        entityType: 'RosterApplication',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: updated.status, comment: dto.comment },
      });
    });

    return this.findOne(id);
  }

  // ---------------------------------------------------------------------
  // Assignation — PATCH /admin/roster-applications/:id/assign.
  // ---------------------------------------------------------------------

  async assign(
    id: number,
    dto: AssignRosterApplicationDto,
    actor: AuthenticatedUser,
  ): Promise<RosterApplicationDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.rosterApplication.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Candidature ${id} introuvable.`);
      }
      if (dto.assignedAdminId !== null) {
        await this.assertAdminExists(tx, dto.assignedAdminId);
      }

      const updated = await tx.rosterApplication.update({
        where: { id },
        data: { assignedAdminId: dto.assignedAdminId },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'roster_application.assigned',
        entityType: 'RosterApplication',
        entityId: id,
        oldValue: { assignedAdminId: existing.assignedAdminId },
        newValue: { assignedAdminId: updated.assignedAdminId },
      });
    });

    return this.findOne(id);
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

  // ---------------------------------------------------------------------
  // §3 — Demande d'informations et refus. Seule messagerie sortante de
  // cette étape en dehors de l'invitation de conversion (§4.4).
  // ---------------------------------------------------------------------

  async requestInfo(
    id: number,
    dto: RequestInfoDto,
    actor: AuthenticatedUser,
  ): Promise<RosterApplicationDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.rosterApplication.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Candidature ${id} introuvable.`);
      }
      if (
        !isApplicationStatusTransitionAllowed(
          existing.status,
          ApplicationStatus.INFO_REQUESTED,
        )
      ) {
        const allowed = getAllowedApplicationTransitions(existing.status);
        throw new BadRequestException(
          `Transition de statut refusée : "${existing.status}" -> "INFO_REQUESTED". Transitions possibles depuis "${existing.status}" : ${allowed.length > 0 ? allowed.join(', ') : '(aucune — statut terminal)'}.`,
        );
      }

      const updated = await tx.rosterApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.INFO_REQUESTED,
          statusChangedAt: new Date(),
        },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'roster_application.status_changed',
        entityType: 'RosterApplication',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: updated.status },
      });
    });

    // Email + journal de l'envoi (§3 : "destinataire, date, contenu") — APRÈS
    // le commit du changement de statut, best-effort comme les autres emails
    // du projet (contrairement à l'email de conversion, §4.1, qui lui DOIT
    // annuler toute l'opération en cas d'échec).
    const application = await this.prisma.rosterApplication.findUniqueOrThrow({
      where: { id },
    });
    try {
      await this.mailService.sendRosterApplicationInfoRequested({
        to: application.workEmail,
        fullName: application.fullName,
        message: dto.message,
        relatedEntityId: application.id,
      });
      await this.activityLog.record(this.prisma, {
        actorId: actor.id,
        action: 'roster_application.info_requested',
        entityType: 'RosterApplication',
        entityId: id,
        oldValue: null,
        newValue: {
          to: application.workEmail,
          message: dto.message,
          sentAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Échec de l'email de demande d'informations pour ${application.reference}`,
        error instanceof Error ? error.stack : error,
      );
    }

    return this.findOne(id);
  }

  async reject(
    id: number,
    dto: RejectRosterApplicationDto,
    actor: AuthenticatedUser,
  ): Promise<RosterApplicationDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.rosterApplication.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Candidature ${id} introuvable.`);
      }
      if (
        !isApplicationStatusTransitionAllowed(
          existing.status,
          ApplicationStatus.REJECTED,
        )
      ) {
        const allowed = getAllowedApplicationTransitions(existing.status);
        throw new BadRequestException(
          `Transition de statut refusée : "${existing.status}" -> "REJECTED". Transitions possibles depuis "${existing.status}" : ${allowed.length > 0 ? allowed.join(', ') : '(aucune — statut terminal)'}.`,
        );
      }

      const updated = await tx.rosterApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.REJECTED,
          statusChangedAt: new Date(),
          rejectionReason: sanitizeText(dto.rejectionReason),
        },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'roster_application.rejected',
        entityType: 'RosterApplication',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: {
          status: updated.status,
          rejectionReason: updated.rejectionReason,
        },
      });
    });

    // Case à cocher EXPLICITE (§3) — jamais automatique.
    if (dto.sendRejectionEmail) {
      const application = await this.prisma.rosterApplication.findUniqueOrThrow(
        { where: { id } },
      );
      try {
        await this.mailService.sendRosterApplicationRejected({
          to: application.workEmail,
          fullName: application.fullName,
          relatedEntityId: application.id,
        });
        await this.activityLog.record(this.prisma, {
          actorId: actor.id,
          action: 'roster_application.rejection_email_sent',
          entityType: 'RosterApplication',
          entityId: id,
          oldValue: null,
          newValue: {
            to: application.workEmail,
            sentAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        this.logger.error(
          `Échec de l'email de refus pour ${application.reference}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    return this.findOne(id);
  }

  // ---------------------------------------------------------------------
  // §4 — LA CONVERSION. Voir CLAUDE.md pour l'explication de la garantie
  // d'idempotence portée par la base plutôt qu'un "vérifier puis créer".
  // ---------------------------------------------------------------------

  async convert(
    id: number,
    actor: AuthenticatedUser,
  ): Promise<ConversionResultDto> {
    let result: {
      userId: number;
      userEmail: string;
      userStatus: UserStatus;
      speakerId: number;
      speakerDisplayName: string;
      speakerSlug: string | null;
      convertedAt: Date;
      fullName: string;
      invitationToken: string;
    };

    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          const application = await tx.rosterApplication.findUnique({
            where: { id },
          });
          if (!application) {
            throw new NotFoundException(`Candidature ${id} introuvable.`);
          }

          if (application.status === ApplicationStatus.CONVERTED) {
            // Le filtre d'exception global (CLAUDE.md §4) normalise TOUTE
            // réponse d'erreur à { statusCode, message, error } — un champ
            // personnalisé (convertedSpeakerId...) serait silencieusement
            // perdu. L'identifiant demandé par le prompt ("en indiquant
            // l'identifiant du speaker créé") est donc porté par le message
            // lui-même, pas par une clé JSON dédiée.
            throw new ConflictException(
              `Cette candidature a déjà été convertie (double appel ou double clic) — speaker #${application.convertedSpeakerId}, compte #${application.convertedUserId}.`,
            );
          }
          if (application.status !== ApplicationStatus.APPROVED) {
            throw new BadRequestException(
              `Seule une candidature "APPROVED" peut être convertie (statut actuel : "${application.status}").`,
            );
          }

          const existingUser = await tx.user.findUnique({
            where: { email: application.workEmail },
          });
          if (existingUser) {
            throw new ConflictException(
              `Un compte existe déjà pour ${application.workEmail} (utilisateur #${existingUser.id}) — utilisez POST .../attach-existing-user plutôt que la conversion standard.`,
            );
          }

          const { firstName, lastName } = this.splitFullName(
            application.fullName,
          );
          const pillarId = await this.resolvePillarId(
            tx,
            application.expertiseArea,
          );
          const slug = await resolveUniqueSlug(tx, application.fullName);

          // a. User SPEAKER, sans mot de passe, email pas encore vérifié —
          //    la possession de la boîte mail sera prouvée par l'accès au
          //    lien d'invitation (§4.4).
          const user = await tx.user.create({
            data: {
              email: application.workEmail,
              role: Role.SPEAKER,
              status: UserStatus.INVITED,
              firstName,
              lastName,
              emailVerifiedAt: null,
            },
          });

          // b. Speaker DRAFT, pré-rempli depuis l'intake — domaines
          //    d'expertise mappés sur un pilier existant SI ET SEULEMENT SI
          //    une correspondance de nom raisonnable existe (voir
          //    resolvePillarId ci-dessous), sinon laissés vides plutôt que
          //    devinés (§4.1.b).
          const speaker = await tx.speaker.create({
            data: {
              userId: user.id,
              firstName,
              lastName,
              slug,
              currentOrganization: application.organization,
              professionalTitle: application.jobTitle,
              linkedinUrl: application.linkedinUrl,
              status: SpeakerStatus.DRAFT,
              pillars: pillarId
                ? { create: [{ pillarId, isPrimary: true }] }
                : undefined,
            },
          });

          // c. Candidature CONVERTED.
          const updatedApplication = await tx.rosterApplication.update({
            where: { id },
            data: {
              status: ApplicationStatus.CONVERTED,
              statusChangedAt: new Date(),
              convertedUserId: user.id,
              convertedSpeakerId: speaker.id,
              convertedAt: new Date(),
            },
          });

          // d. Token d'invitation (§4.4) — persisté ICI, dans la
          //    transaction (écriture DB rapide, comme le reste). L'ENVOI de
          //    l'email, lui, se fait APRÈS le commit (voir plus bas) : un
          //    appel SMTP dure plusieurs secondes et garderait des verrous
          //    ouverts pendant tout ce temps, avec un risque réel de
          //    timeout de transaction — rencontré concrètement en
          //    production sur `seed:demo-speakers` (transaction distante
          //    close avant la fin d'un traitement trop long). Règle valable
          //    pour TOUT le projet, pas seulement ici (voir CLAUDE.md) :
          //    aucun envoi d'email ne doit jamais se trouver DANS une
          //    transaction Prisma. Un échec d'envoi n'annule donc PLUS la
          //    conversion — le compte, la fiche et le token existent déjà
          //    et restent valables, seul l'email échoue (journalisé
          //    FAILED dans email_deliveries, renvoyable via
          //    POST .../resend-invitation).
          const token = randomBytes(32).toString('hex');
          const ttlDays = this.config.get<number>(
            'INVITATION_TOKEN_TTL_DAYS',
            DEFAULT_INVITATION_TOKEN_TTL_DAYS,
          );
          const expiresAt = new Date(
            Date.now() + ttlDays * 24 * 60 * 60 * 1000,
          );
          await tx.invitationToken.create({
            data: { userId: user.id, token, expiresAt },
          });

          await this.activityLog.record(tx, {
            actorId: actor.id,
            action: 'roster_application.converted',
            entityType: 'RosterApplication',
            entityId: id,
            oldValue: { status: application.status },
            newValue: {
              status: updatedApplication.status,
              convertedUserId: user.id,
              convertedSpeakerId: speaker.id,
            },
          });

          return {
            userId: user.id,
            userEmail: user.email,
            userStatus: user.status,
            speakerId: speaker.id,
            speakerDisplayName: `${speaker.firstName} ${speaker.lastName}`,
            speakerSlug: speaker.slug,
            convertedAt: updatedApplication.convertedAt!,
            fullName: application.fullName,
            invitationToken: token,
          };
        },
        { timeout: CONVERSION_TRANSACTION_TIMEOUT_MS },
      );
    } catch (error) {
      if (this.isPrismaUniqueConflict(error)) {
        // Course concurrente : l'autre appel a gagné entre notre lecture du
        // statut et notre écriture — on relit l'état désormais committé.
        const winner = await this.prisma.rosterApplication.findUnique({
          where: { id },
        });
        if (winner?.status === ApplicationStatus.CONVERTED) {
          throw new ConflictException(
            `Cette candidature vient d'être convertie par un appel concurrent — speaker #${winner.convertedSpeakerId}, compte #${winner.convertedUserId}.`,
          );
        }
      }
      throw error;
    }

    // Email envoyé APRÈS le commit — voir le commentaire au point d. plus
    // haut. Un échec ici NE remet PAS en cause la conversion : le compte,
    // la fiche et le token existent déjà. `invitationSent` reflète le
    // résultat réel de CETTE tentative (l'admin peut renvoyer l'invitation
    // si elle est à `false` — voir POST .../resend-invitation).
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    const invitationUrl = `${frontendUrl}/accept-invitation?token=${result.invitationToken}`;
    let invitationSent = true;
    try {
      await this.mailService.sendRosterApplicationInvitation({
        to: result.userEmail,
        fullName: result.fullName,
        invitationUrl,
        relatedEntityId: id,
      });
    } catch (error) {
      invitationSent = false;
      this.logger.error(
        `Échec de l'envoi d'invitation pour ${result.userEmail} (candidature ${id})`,
        error instanceof Error ? error.stack : error,
      );
    }

    return {
      applicationId: id,
      user: {
        id: result.userId,
        email: result.userEmail,
        status: result.userStatus,
      },
      speaker: {
        id: result.speakerId,
        displayName: result.speakerDisplayName,
        slug: result.speakerSlug,
      },
      convertedAt: result.convertedAt,
      invitationSent,
    };
  }

  // §4.3 — email déjà utilisé : rattachement explicite à un compte existant,
  // en connaissance de cause. Réutilise le Speaker existant si ce user en a
  // déjà un (cas "speaker déjà au roster qui re-candidate"), sinon en crée un
  // DRAFT comme pour convert() (cas "un admin qui postule").
  async attachExistingUser(
    id: number,
    dto: AttachExistingUserDto,
    actor: AuthenticatedUser,
  ): Promise<ConversionResultDto> {
    let result: {
      userId: number;
      userEmail: string;
      userStatus: UserStatus;
      speakerId: number;
      speakerDisplayName: string;
      speakerSlug: string | null;
      convertedAt: Date;
    };

    try {
      result = await this.prisma.$transaction(async (tx) => {
        const application = await tx.rosterApplication.findUnique({
          where: { id },
        });
        if (!application) {
          throw new NotFoundException(`Candidature ${id} introuvable.`);
        }
        if (application.status === ApplicationStatus.CONVERTED) {
          throw new ConflictException(
            `Cette candidature a déjà été convertie — speaker #${application.convertedSpeakerId}, compte #${application.convertedUserId}.`,
          );
        }
        if (application.status !== ApplicationStatus.APPROVED) {
          throw new BadRequestException(
            `Seule une candidature "APPROVED" peut être rattachée (statut actuel : "${application.status}").`,
          );
        }

        const user = await tx.user.findUnique({
          where: { id: dto.userId },
          include: { speakerProfile: true },
        });
        if (!user) {
          throw new BadRequestException(
            `Utilisateur ${dto.userId} introuvable.`,
          );
        }

        let speakerId: number;
        let speakerDisplayName: string;
        let speakerSlug: string | null;
        if (user.speakerProfile) {
          speakerId = user.speakerProfile.id;
          speakerDisplayName =
            user.speakerProfile.publicName ??
            `${user.speakerProfile.firstName} ${user.speakerProfile.lastName}`;
          speakerSlug = user.speakerProfile.slug;
        } else {
          const { firstName, lastName } = this.splitFullName(
            application.fullName,
          );
          const pillarId = await this.resolvePillarId(
            tx,
            application.expertiseArea,
          );
          const slug = await resolveUniqueSlug(tx, application.fullName);
          const speaker = await tx.speaker.create({
            data: {
              userId: user.id,
              firstName,
              lastName,
              slug,
              currentOrganization: application.organization,
              professionalTitle: application.jobTitle,
              linkedinUrl: application.linkedinUrl,
              status: SpeakerStatus.DRAFT,
              pillars: pillarId
                ? { create: [{ pillarId, isPrimary: true }] }
                : undefined,
            },
          });
          speakerId = speaker.id;
          speakerDisplayName = `${speaker.firstName} ${speaker.lastName}`;
          speakerSlug = speaker.slug;
        }

        const updatedApplication = await tx.rosterApplication.update({
          where: { id },
          data: {
            status: ApplicationStatus.CONVERTED,
            statusChangedAt: new Date(),
            convertedUserId: user.id,
            convertedSpeakerId: speakerId,
            convertedAt: new Date(),
          },
        });

        await this.activityLog.record(tx, {
          actorId: actor.id,
          action: 'roster_application.attached_to_existing_user',
          entityType: 'RosterApplication',
          entityId: id,
          oldValue: { status: application.status },
          newValue: {
            status: updatedApplication.status,
            convertedUserId: user.id,
            convertedSpeakerId: speakerId,
          },
        });

        return {
          userId: user.id,
          userEmail: user.email,
          userStatus: user.status,
          speakerId,
          speakerDisplayName,
          speakerSlug,
          convertedAt: updatedApplication.convertedAt!,
        };
      });
    } catch (error) {
      if (this.isPrismaUniqueConflict(error)) {
        const winner = await this.prisma.rosterApplication.findUnique({
          where: { id },
        });
        if (winner?.status === ApplicationStatus.CONVERTED) {
          throw new ConflictException(
            `Cette candidature vient d'être convertie par un appel concurrent — speaker #${winner.convertedSpeakerId}, compte #${winner.convertedUserId}.`,
          );
        }
      }
      throw error;
    }

    return {
      applicationId: id,
      user: {
        id: result.userId,
        email: result.userEmail,
        status: result.userStatus,
      },
      speaker: {
        id: result.speakerId,
        displayName: result.speakerDisplayName,
        slug: result.speakerSlug,
      },
      convertedAt: result.convertedAt,
      // Pas d'invitation ici — le compte existe déjà, ce n'est pas à cette
      // action de décider s'il a besoin d'un nouveau mot de passe.
    };
  }

  // POST /admin/roster-applications/:id/resend-invitation — invalide le
  // token précédent avant d'en émettre un nouveau (§4.4) : jamais deux
  // tokens actifs pour le même compte.
  async resendInvitation(
    id: number,
    actor: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const application = await this.prisma.rosterApplication.findUnique({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException(`Candidature ${id} introuvable.`);
    }
    if (
      application.status !== ApplicationStatus.CONVERTED ||
      !application.convertedUserId
    ) {
      throw new BadRequestException(
        "Cette candidature n'a pas encore été convertie — aucune invitation à renvoyer.",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: application.convertedUserId },
    });
    if (!user) {
      throw new NotFoundException('Compte introuvable.');
    }

    const token = randomBytes(32).toString('hex');
    const ttlDays = this.config.get<number>(
      'INVITATION_TOKEN_TTL_DAYS',
      DEFAULT_INVITATION_TOKEN_TTL_DAYS,
    );
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      // Invalide TOUS les tokens encore actifs pour ce user (normalement un
      // seul, mais robuste même s'il y en avait plusieurs par erreur).
      await tx.invitationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.invitationToken.create({
        data: { userId: user.id, token, expiresAt },
      });
      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'roster_application.invitation_resent',
        entityType: 'RosterApplication',
        entityId: id,
        oldValue: null,
        newValue: { to: user.email },
      });
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    const invitationUrl = `${frontendUrl}/accept-invitation?token=${token}`;
    try {
      await this.mailService.sendRosterApplicationInvitation({
        to: user.email,
        fullName:
          `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
        invitationUrl,
        relatedEntityId: id,
      });
    } catch (error) {
      this.logger.error(
        `Échec du renvoi d'invitation pour ${user.email}`,
        error instanceof Error ? error.stack : error,
      );
    }

    return { message: 'Invitation renvoyée.' };
  }

  // POST /auth/accept-invitation (public — voir InvitationAcceptController).
  async acceptInvitation(dto: AcceptInvitationDto): Promise<TokenPair> {
    const record = await this.prisma.invitationToken.findUnique({
      where: { token: dto.token },
    });
    if (!record || record.usedAt) {
      throw new UnauthorizedException(
        "Ce lien d'invitation est invalide ou a déjà été utilisé. Demandez à l'équipe de vous en renvoyer un nouveau.",
      );
    }
    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException(
        "Ce lien d'invitation a expiré. Demandez à l'équipe de vous en renvoyer un nouveau.",
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST_FACTOR);

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.invitationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      return tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
          // L'accès au lien prouve la possession de la boîte mail (§4.4).
          emailVerifiedAt: new Date(),
          acceptedTermsAt: new Date(),
          acceptedTermsVersion: CURRENT_TERMS_VERSION,
        },
      });
    });

    return this.authService.issueTokenPairForUser(user);
  }

  private isPrismaUniqueConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  // Heuristique volontairement simple ("hypothèse raisonnable", cf. le reste
  // du projet) : premier mot = prénom, reste = nom de famille ; si un seul
  // mot, il sert aux deux (le candidat pourra corriger via son profil DRAFT
  // une fois connecté — §4.5). Jamais de "devinette" plus poussée.
  private splitFullName(fullName: string): {
    firstName: string;
    lastName: string;
  } {
    const trimmed = fullName.trim();
    const spaceIndex = trimmed.indexOf(' ');
    if (spaceIndex === -1) {
      return { firstName: trimmed, lastName: trimmed };
    }
    return {
      firstName: trimmed.slice(0, spaceIndex),
      lastName: trimmed.slice(spaceIndex + 1).trim(),
    };
  }

  // §4.1.b — "domaines d'expertise si mappables sur les piliers existants —
  // sinon laissés vides plutôt que devinés." Correspondance EXACTE
  // (insensible à la casse — collation MySQL par défaut, cf. le reste du
  // projet) entre expertiseArea (texte libre d'intake) et le nom d'un
  // pilier existant. Pas de correspondance approximative (contains,
  // distance de Levenshtein...) : le risque de mal classer un candidat sur
  // un pilier qu'il n'a jamais mentionné dépasse le bénéfice d'un
  // pré-remplissage plus agressif — un admin corrige en quelques secondes
  // depuis la fiche DRAFT, deviner faux coûte plus cher à corriger.
  private async resolvePillarId(
    tx: Prisma.TransactionClient,
    expertiseArea: string | null,
  ): Promise<number | undefined> {
    if (!expertiseArea) return undefined;
    const trimmed = expertiseArea.trim();
    if (!trimmed) return undefined;
    const pillar = await tx.pillar.findFirst({
      where: { name: { equals: trimmed } },
      select: { id: true },
    });
    return pillar?.id;
  }
}
