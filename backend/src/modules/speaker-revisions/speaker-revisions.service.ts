import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RevisionStatus, SpeakerStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { MailService } from '../../mail/mail.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import {
  SPEAKER_DETAIL_INCLUDE,
  SpeakerDetailRow,
} from '../speakers/speakers.includes';
import { toDetailDto } from '../speakers/mappers/speaker.mapper';
import { calculateCompletionScore } from '../speakers/completion-score.util';
import {
  getMissingPublishRequirements,
  isTransitionAllowed,
} from '../speakers/status-transitions.util';
import {
  assertPrimaryPillarCount,
  assertThemesMatchPillars,
} from '../speakers/speaker-invariants.util';
import { PublicSpeakerDetailDto } from '../public/dto/public-speaker-detail.dto';
import {
  SPEAKER_REVISION_INCLUDE,
  SpeakerRevisionRow,
} from './speaker-revisions.includes';
import {
  scalarSnapshot,
  toAdminRef,
  toListItemDto,
  toSpeakerRef,
  toSummaryDto,
} from './mappers/speaker-revision.mapper';
import { SpeakerRevisionDiffService } from './speaker-revision-diff.service';
import { SpeakerRevisionPreviewService } from './speaker-revision-preview.service';
import { SpeakerRevisionPayloadDto } from './dto/speaker-revision-payload.dto';
import { QuerySpeakerRevisionsDto } from './dto/query-speaker-revisions.dto';
import { RequestChangesDto } from './dto/request-changes.dto';
import { RejectRevisionDto } from './dto/reject-revision.dto';
import { SpeakerRevisionSummaryDto } from './dto/outputs/speaker-revision-summary.dto';
import { SpeakerMeProfileDto } from './dto/outputs/speaker-me-profile.dto';
import { SpeakerRevisionListResponseDto } from './dto/outputs/speaker-revision-list-item.dto';
import { SpeakerRevisionDetailDto } from './dto/outputs/speaker-revision-detail.dto';

// "Actif" = en cours, bloque un nouveau brouillon ET fait partie de ce que le
// speaker peut consulter/éditer via /speaker/me/*. CHANGES_REQUESTED est
// inclus en plus des DRAFT/SUBMITTED du §1 : c'est fonctionnellement "un
// brouillon qui attend d'être retravaillé" — l'éditer (PUT) le repasse en
// DRAFT (voir saveOwnDraft), ce qui satisfait l'invariant "un seul brouillon
// actif" du cahier des charges sans permettre une révision CHANGES_REQUESTED
// et une nouvelle DRAFT simultanées.
const ACTIVE_REVISION_STATUSES: RevisionStatus[] = [
  RevisionStatus.DRAFT,
  RevisionStatus.SUBMITTED,
  RevisionStatus.CHANGES_REQUESTED,
];

@Injectable()
export class SpeakerRevisionsService {
  private readonly logger = new Logger(SpeakerRevisionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly diffService: SpeakerRevisionDiffService,
    private readonly previewService: SpeakerRevisionPreviewService,
  ) {}

  // ---------------------------------------------------------------------
  // Résolution de propriété — NON CONTOURNABLE : chaque méthode "own*"
  // dérive le speaker UNIQUEMENT depuis `actor.id` (l'utilisateur authentifié
  // du JWT). Aucune route /speaker/me/* n'accepte le moindre identifiant
  // fourni par l'appelant — il n'y a donc littéralement rien à manipuler pour
  // accéder au profil ou à la révision d'un autre speaker : ce n'est pas une
  // vérification qu'on pourrait oublier d'ajouter sur un futur endpoint,
  // c'est l'unique façon dont ce service sait QUEL speaker traiter.
  // ---------------------------------------------------------------------

  private async getOwnSpeakerOrThrow(
    userId: number,
  ): Promise<SpeakerDetailRow> {
    const speaker = await this.prisma.speaker.findFirst({
      where: { userId, deletedAt: null },
      include: SPEAKER_DETAIL_INCLUDE,
    });
    if (!speaker) {
      throw new NotFoundException('Aucun profil speaker lié à ce compte.');
    }
    return speaker;
  }

  private async findActiveRevision(
    speakerId: number,
  ): Promise<SpeakerRevisionRow | null> {
    return this.prisma.speakerRevision.findFirst({
      where: { speakerId, status: { in: ACTIVE_REVISION_STATUSES } },
      include: SPEAKER_REVISION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------
  // Self-service SPEAKER
  // ---------------------------------------------------------------------

  async getOwnProfile(actor: AuthenticatedUser): Promise<SpeakerMeProfileDto> {
    const speaker = await this.getOwnSpeakerOrThrow(actor.id);
    const activeRevision = await this.findActiveRevision(speaker.id);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pricing, ...profile } = toDetailDto(speaker);

    return {
      profile,
      currentRevision: activeRevision ? toSummaryDto(activeRevision) : null,
    };
  }

  async getOwnRevision(
    actor: AuthenticatedUser,
  ): Promise<SpeakerRevisionSummaryDto | null> {
    const speaker = await this.getOwnSpeakerOrThrow(actor.id);
    const revision = await this.findActiveRevision(speaker.id);
    return revision ? toSummaryDto(revision) : null;
  }

  async saveOwnDraft(
    actor: AuthenticatedUser,
    dto: SpeakerRevisionPayloadDto,
  ): Promise<SpeakerRevisionSummaryDto> {
    const speaker = await this.getOwnSpeakerOrThrow(actor.id);

    // Mêmes règles structurelles que le CRUD admin (voir speaker-invariants.util.ts) —
    // feedback immédiat au speaker plutôt que de laisser un admin découvrir le
    // problème dans le diff. Revalidées une seconde fois à l'approbation (le
    // "effectif" peut avoir dérivé entretemps si pillars/themeIds sont absents
    // du payload — voir approve()).
    assertPrimaryPillarCount(dto.pillars);
    const effectivePillarIds = dto.pillars
      ? dto.pillars.map((p) => p.pillarId)
      : speaker.pillars.map((p) => p.pillarId);
    const effectiveThemeIds =
      dto.themeIds ?? speaker.themes.map((t) => t.themeId);
    await assertThemesMatchPillars(
      this.prisma,
      effectiveThemeIds,
      effectivePillarIds,
    );

    // JSON.parse(JSON.stringify(...)) : même garde-fou que
    // ActivityLogService.toJsonInput — s'assure que seules des valeurs
    // strictement sérialisables JSON atterrissent dans la colonne Json.
    const payloadJson = JSON.parse(
      JSON.stringify(dto),
    ) as Prisma.InputJsonValue;

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.speakerRevision.findFirst({
        where: {
          speakerId: speaker.id,
          status: { in: ACTIVE_REVISION_STATUSES },
        },
        include: SPEAKER_REVISION_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });

      if (existing?.status === RevisionStatus.SUBMITTED) {
        throw new BadRequestException(
          'Une révision est déjà soumise pour validation — retirez-la (withdraw) avant de la modifier.',
        );
      }

      let revision: SpeakerRevisionRow;
      if (existing) {
        // DRAFT ou CHANGES_REQUESTED existant : mise à jour en place, et
        // repasse en DRAFT (le commentaire admin devient obsolète, le
        // speaker retravaille sa proposition).
        revision = await tx.speakerRevision.update({
          where: { id: existing.id },
          data: {
            payload: payloadJson,
            status: RevisionStatus.DRAFT,
            reviewerComment: null,
          },
          include: SPEAKER_REVISION_INCLUDE,
        });
        await this.activityLog.record(tx, {
          actorId: actor.id,
          action: 'speaker_revision.draft_updated',
          entityType: 'SpeakerRevision',
          entityId: revision.id,
          oldValue: scalarSnapshot(existing),
          newValue: scalarSnapshot(revision),
        });
      } else {
        try {
          revision = await tx.speakerRevision.create({
            data: {
              speakerId: speaker.id,
              payload: payloadJson,
              status: RevisionStatus.DRAFT,
              // Voir le commentaire sur `activeGuard` dans schema.prisma :
              // ferme, au niveau DB, la fenêtre de course entre le `findFirst`
              // ci-dessus et cette création (deux PUT quasi simultanés).
              activeGuard: speaker.id,
            },
            include: SPEAKER_REVISION_INCLUDE,
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new ConflictException(
              'Une révision active existe déjà pour ce profil — réessayez.',
            );
          }
          throw error;
        }
        await this.activityLog.record(tx, {
          actorId: actor.id,
          action: 'speaker_revision.draft_created',
          entityType: 'SpeakerRevision',
          entityId: revision.id,
          oldValue: null,
          newValue: scalarSnapshot(revision),
        });
      }

      return revision;
    });

    return toSummaryDto(result);
  }

  async submitOwnRevision(
    actor: AuthenticatedUser,
  ): Promise<SpeakerRevisionSummaryDto> {
    const speaker = await this.getOwnSpeakerOrThrow(actor.id);

    const result = await this.prisma.$transaction(async (tx) => {
      const revision = await tx.speakerRevision.findFirst({
        where: {
          speakerId: speaker.id,
          status: { in: ACTIVE_REVISION_STATUSES },
        },
        include: SPEAKER_REVISION_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
      if (!revision) {
        throw new NotFoundException('Aucun brouillon à soumettre.');
      }
      if (revision.status !== RevisionStatus.DRAFT) {
        throw new BadRequestException(
          `Impossible de soumettre une révision au statut "${revision.status}".`,
        );
      }

      const updated = await tx.speakerRevision.update({
        where: { id: revision.id },
        data: { status: RevisionStatus.SUBMITTED, submittedAt: new Date() },
        include: SPEAKER_REVISION_INCLUDE,
      });

      // Onboarding pré-publication UNIQUEMENT (DRAFT/INCOMPLETE/CHANGES_REQUESTED
      // → PENDING_VALIDATION, transitions déjà autorisées par le graphe de
      // modules/speakers/status-transitions.util.ts) : une fiche déjà
      // PUBLISHED (ou SUSPENDED/UNPUBLISHED/ARCHIVED) n'a AUCUNE de ces
      // transitions autorisées vers PENDING_VALIDATION, donc son statut/sa
      // visibilité live restent intacts — la révision n'a aucun effet sur ce
      // que voit le public tant qu'elle n'est pas approuvée (cf. §2).
      if (
        speaker.status !== SpeakerStatus.PENDING_VALIDATION &&
        isTransitionAllowed(speaker.status, SpeakerStatus.PENDING_VALIDATION)
      ) {
        await tx.speaker.update({
          where: { id: speaker.id },
          data: { status: SpeakerStatus.PENDING_VALIDATION },
        });
      }

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_revision.submitted',
        entityType: 'SpeakerRevision',
        entityId: revision.id,
        oldValue: scalarSnapshot(revision),
        newValue: scalarSnapshot(updated),
      });

      return updated;
    });

    await this.sendTeamSubmittedNotification(result, speaker);

    return toSummaryDto(result);
  }

  async withdrawOwnRevision(
    actor: AuthenticatedUser,
  ): Promise<SpeakerRevisionSummaryDto> {
    const speaker = await this.getOwnSpeakerOrThrow(actor.id);

    const result = await this.prisma.$transaction(async (tx) => {
      const revision = await tx.speakerRevision.findFirst({
        where: { speakerId: speaker.id, status: RevisionStatus.SUBMITTED },
        include: SPEAKER_REVISION_INCLUDE,
      });
      if (!revision) {
        throw new NotFoundException('Aucune révision soumise à retirer.');
      }

      const updated = await tx.speakerRevision.update({
        where: { id: revision.id },
        data: { status: RevisionStatus.DRAFT, submittedAt: null },
        include: SPEAKER_REVISION_INCLUDE,
      });

      // Pas de retour arrière du statut speaker ici volontairement :
      // PENDING_VALIDATION → DRAFT n'existe pas dans le graphe de transitions
      // (seul un admin fait reculer un statut, via CHANGES_REQUESTED). Un
      // retrait par le speaker lui-même laisse donc speaker.status inchangé.
      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_revision.withdrawn',
        entityType: 'SpeakerRevision',
        entityId: revision.id,
        oldValue: scalarSnapshot(revision),
        newValue: scalarSnapshot(updated),
      });

      return updated;
    });

    return toSummaryDto(result);
  }

  async previewOwnRevision(
    actor: AuthenticatedUser,
  ): Promise<PublicSpeakerDetailDto> {
    const speaker = await this.getOwnSpeakerOrThrow(actor.id);
    const revision = await this.findActiveRevision(speaker.id);
    if (!revision) {
      throw new NotFoundException('Aucun brouillon à prévisualiser.');
    }
    return this.previewService.buildPreview(
      speaker,
      revision.payload as SpeakerRevisionPayloadDto,
    );
  }

  // ---------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------

  async findAll(
    query: QuerySpeakerRevisionsDto,
  ): Promise<SpeakerRevisionListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: Prisma.SpeakerRevisionWhereInput = query.status
      ? { status: query.status }
      : {};

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.speakerRevision.count({ where }),
      this.prisma.speakerRevision.findMany({
        where,
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        include: SPEAKER_REVISION_INCLUDE,
      }),
    ]);

    return {
      data: rows.map(toListItemDto),
      meta: { total, page, perPage },
    };
  }

  async findOne(id: number): Promise<SpeakerRevisionDetailDto> {
    const revision = await this.prisma.speakerRevision.findUnique({
      where: { id },
      include: SPEAKER_REVISION_INCLUDE,
    });
    if (!revision) {
      throw new NotFoundException(`Révision ${id} introuvable.`);
    }
    return this.toDetailDtoWithDiff(revision);
  }

  async approve(
    id: number,
    actor: AuthenticatedUser,
  ): Promise<SpeakerRevisionDetailDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const revision = await tx.speakerRevision.findUnique({
        where: { id },
        include: SPEAKER_REVISION_INCLUDE,
      });
      if (!revision) {
        throw new NotFoundException(`Révision ${id} introuvable.`);
      }
      if (revision.status !== RevisionStatus.SUBMITTED) {
        throw new BadRequestException(
          `Seule une révision "SUBMITTED" peut être approuvée (statut actuel : "${revision.status}").`,
        );
      }

      const speaker = await tx.speaker.findUniqueOrThrow({
        where: { id: revision.speakerId },
        include: SPEAKER_DETAIL_INCLUDE,
      });
      const payload = revision.payload as SpeakerRevisionPayloadDto;

      // Défense en profondeur : déjà vérifié à saveOwnDraft, mais revérifié
      // ici contre le LIVE ACTUEL (peut avoir dérivé depuis la soumission —
      // même principe que le diff, toujours recalculé au moment présent,
      // jamais depuis un instantané figé).
      assertPrimaryPillarCount(payload.pillars);
      const effectivePillarIds = payload.pillars
        ? payload.pillars.map((p) => p.pillarId)
        : speaker.pillars.map((p) => p.pillarId);
      const effectiveThemeIds =
        payload.themeIds ?? speaker.themes.map((t) => t.themeId);
      await assertThemesMatchPillars(tx, effectiveThemeIds, effectivePillarIds);

      const applied = await tx.speaker.update({
        where: { id: speaker.id },
        data: this.buildSpeakerUpdateData(payload),
        include: SPEAKER_DETAIL_INCLUDE,
      });

      const completionScore = calculateCompletionScore(applied);
      const finalSpeaker =
        completionScore === applied.completionScore
          ? applied
          : await tx.speaker.update({
              where: { id: speaker.id },
              data: { completionScore },
              include: SPEAKER_DETAIL_INCLUDE,
            });

      // Un speaker déjà PUBLISHED reste PUBLISHED tout au long de
      // l'approbation (cf. plus bas), donc rien ne revérifie jamais les
      // pré-requis de publication sur ce chemin — contrairement à
      // PATCH /admin/speakers/:id/status, qui les vérifie explicitement
      // avant tout passage à PUBLISHED. Sans ce contrôle, une révision
      // pourrait vider shortBio/profilePhotoUrl/pillars sur une fiche déjà
      // publiée et le public le verrait immédiatement. On refuse
      // l'approbation (la transaction est annulée, rien n'est appliqué) avec
      // le même message que l'admin connaît déjà de ce second endpoint.
      if (finalSpeaker.status === SpeakerStatus.PUBLISHED) {
        const missing = getMissingPublishRequirements(finalSpeaker);
        if (missing.length > 0) {
          throw new BadRequestException(
            `Cette révision rendrait la fiche publiée incomplète, champs manquants : ${missing.join(', ')}. Utilisez "demander des corrections" plutôt qu'"approuver".`,
          );
        }
      }

      // Statut speaker : seulement le cas pré-publication. PENDING_VALIDATION
      // est le cas normal ; CHANGES_REQUESTED est traité explicitement ici en
      // plus (cf. §7 — pas via isTransitionAllowed du graphe générique, qui
      // n'autorise pas CHANGES_REQUESTED → APPROVED directement : l'approbation
      // d'une révision est un contexte différent d'un changement de statut
      // admin "à la main", avec sa propre règle plus permissive pour ce cas
      // précis). Un speaker déjà PUBLISHED (édition d'une fiche existante)
      // n'est concerné par AUCUN des deux cas : son statut/visibilité live ne
      // bougent jamais ici — cf. §7, "une approbation ne doit jamais publier
      // automatiquement un speaker non publié".
      if (
        finalSpeaker.status === SpeakerStatus.PENDING_VALIDATION ||
        finalSpeaker.status === SpeakerStatus.CHANGES_REQUESTED
      ) {
        await tx.speaker.update({
          where: { id: speaker.id },
          data: { status: SpeakerStatus.APPROVED },
        });
      }

      const approvedRevision = await tx.speakerRevision.update({
        where: { id },
        data: {
          status: RevisionStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedById: actor.id,
          // Statut terminal : libère le "slot" activeGuard, un nouveau
          // brouillon devient possible.
          activeGuard: null,
        },
        include: SPEAKER_REVISION_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_revision.approved',
        entityType: 'SpeakerRevision',
        entityId: id,
        oldValue: scalarSnapshot(revision),
        newValue: scalarSnapshot(approvedRevision),
      });
      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker.updated_via_revision',
        entityType: 'Speaker',
        entityId: speaker.id,
        oldValue: { updatedAt: speaker.updatedAt },
        newValue: { updatedAt: finalSpeaker.updatedAt },
      });

      return approvedRevision;
    });

    await this.sendApprovedNotification(result);

    return this.toDetailDtoWithDiff(result);
  }

  async requestChanges(
    id: number,
    dto: RequestChangesDto,
    actor: AuthenticatedUser,
  ): Promise<SpeakerRevisionDetailDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const revision = await tx.speakerRevision.findUnique({
        where: { id },
        include: SPEAKER_REVISION_INCLUDE,
      });
      if (!revision) {
        throw new NotFoundException(`Révision ${id} introuvable.`);
      }
      if (revision.status !== RevisionStatus.SUBMITTED) {
        throw new BadRequestException(
          `Seule une révision "SUBMITTED" peut recevoir une demande de correction (statut actuel : "${revision.status}").`,
        );
      }

      const speaker = await tx.speaker.findUniqueOrThrow({
        where: { id: revision.speakerId },
        select: { id: true, status: true },
      });

      const updated = await tx.speakerRevision.update({
        where: { id },
        data: {
          status: RevisionStatus.CHANGES_REQUESTED,
          reviewedAt: new Date(),
          reviewedById: actor.id,
          reviewerComment: dto.reviewerComment,
        },
        include: SPEAKER_REVISION_INCLUDE,
      });

      // Pré-publication uniquement (cf. approve() pour le même raisonnement) :
      // une fiche déjà PUBLISHED garde son statut live intact.
      if (speaker.status === SpeakerStatus.PENDING_VALIDATION) {
        await tx.speaker.update({
          where: { id: speaker.id },
          data: { status: SpeakerStatus.CHANGES_REQUESTED },
        });
      }

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_revision.changes_requested',
        entityType: 'SpeakerRevision',
        entityId: id,
        oldValue: scalarSnapshot(revision),
        newValue: scalarSnapshot(updated),
      });

      return updated;
    });

    await this.sendChangesRequestedNotification(result);

    return this.toDetailDtoWithDiff(result);
  }

  async reject(
    id: number,
    dto: RejectRevisionDto,
    actor: AuthenticatedUser,
  ): Promise<SpeakerRevisionDetailDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const revision = await tx.speakerRevision.findUnique({
        where: { id },
        include: SPEAKER_REVISION_INCLUDE,
      });
      if (!revision) {
        throw new NotFoundException(`Révision ${id} introuvable.`);
      }
      if (revision.status !== RevisionStatus.SUBMITTED) {
        throw new BadRequestException(
          `Seule une révision "SUBMITTED" peut être refusée (statut actuel : "${revision.status}").`,
        );
      }

      const updated = await tx.speakerRevision.update({
        where: { id },
        data: {
          status: RevisionStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedById: actor.id,
          reviewerComment: dto.reviewerComment,
          activeGuard: null,
        },
        include: SPEAKER_REVISION_INCLUDE,
      });

      // Pas d'effet sur speaker.status ici, volontairement : un refus porte
      // sur CETTE proposition de modification, pas sur le compte/profil du
      // speaker dans son ensemble — un admin qui veut aussi agir sur le
      // statut du speaker (ex. APPLICATION_REJECTED) le fait explicitement
      // via l'endpoint dédié de la Phase 1b.
      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_revision.rejected',
        entityType: 'SpeakerRevision',
        entityId: id,
        oldValue: scalarSnapshot(revision),
        newValue: scalarSnapshot(updated),
      });

      return updated;
    });

    await this.sendRejectedNotification(result);

    return this.toDetailDtoWithDiff(result);
  }

  // ---------------------------------------------------------------------
  // Construction du payload d'update Speaker (approbation)
  // ---------------------------------------------------------------------

  private buildSpeakerUpdateData(
    payload: SpeakerRevisionPayloadDto,
  ): Prisma.SpeakerUncheckedUpdateInput {
    const data: Prisma.SpeakerUncheckedUpdateInput = {};

    if (payload.civility !== undefined) data.civility = payload.civility;
    if (payload.firstName !== undefined) data.firstName = payload.firstName;
    if (payload.lastName !== undefined) data.lastName = payload.lastName;
    if (payload.publicName !== undefined) data.publicName = payload.publicName;
    if (payload.phone !== undefined) data.phone = payload.phone;
    if (payload.city !== undefined) data.city = payload.city;
    if (payload.timezone !== undefined) data.timezone = payload.timezone;
    if (payload.countryId !== undefined) data.countryId = payload.countryId;
    if (payload.profilePhotoUrl !== undefined)
      data.profilePhotoUrl = payload.profilePhotoUrl;
    if (payload.coverPhotoUrl !== undefined)
      data.coverPhotoUrl = payload.coverPhotoUrl;
    if (payload.professionalTitle !== undefined)
      data.professionalTitle = payload.professionalTitle;
    if (payload.currentOrganization !== undefined)
      data.currentOrganization = payload.currentOrganization;
    if (payload.currentPosition !== undefined)
      data.currentPosition = payload.currentPosition;
    if (payload.websiteUrl !== undefined) data.websiteUrl = payload.websiteUrl;
    if (payload.linkedinUrl !== undefined)
      data.linkedinUrl = payload.linkedinUrl;
    if (payload.socialLinks !== undefined) {
      data.socialLinks =
        payload.socialLinks as unknown as Prisma.InputJsonValue;
    }
    if (payload.shortBio !== undefined) data.shortBio = payload.shortBio;
    if (payload.fullBio !== undefined) data.fullBio = payload.fullBio;
    if (payload.quote !== undefined) data.quote = payload.quote;
    if (payload.expertiseSummary !== undefined)
      data.expertiseSummary = payload.expertiseSummary;
    if (payload.valueProposition !== undefined)
      data.valueProposition = payload.valueProposition;
    if (payload.careerPath !== undefined) data.careerPath = payload.careerPath;
    if (payload.keyAchievements !== undefined)
      data.keyAchievements = payload.keyAchievements;
    if (payload.awards !== undefined) data.awards = payload.awards;

    if (payload.pillars) {
      data.pillars = {
        deleteMany: {},
        create: payload.pillars.map((p) => ({
          pillarId: p.pillarId,
          isPrimary: p.isPrimary ?? false,
          displayOrder: p.displayOrder ?? 0,
        })),
      };
    }
    if (payload.themeIds) {
      data.themes = {
        deleteMany: {},
        create: payload.themeIds.map((themeId) => ({ themeId })),
      };
    }
    if (payload.keywords) {
      data.keywords = {
        deleteMany: {},
        create: payload.keywords.map((keyword) => ({ keyword })),
      };
    }
    if (payload.formatIds) {
      data.formats = {
        deleteMany: {},
        create: payload.formatIds.map((formatId) => ({ formatId })),
      };
    }
    if (payload.languages) {
      data.languages = {
        deleteMany: {},
        create: payload.languages.map((l) => ({
          languageId: l.languageId,
          proficiency: l.proficiency,
          canPresent: l.canPresent,
          canQa: l.canQa,
          canModerate: l.canModerate,
        })),
      };
    }
    if (payload.engagements) {
      data.engagements = {
        deleteMany: {},
        create: payload.engagements.map((e) => ({
          eventName: e.eventName,
          organization: e.organization,
          countryId: e.countryId,
          eventDate: e.eventDate ? new Date(e.eventDate) : undefined,
          dateLabel: e.dateLabel,
          role: e.role,
          topic: e.topic,
          description: e.description,
          photoUrl: e.photoUrl,
          videoUrl: e.videoUrl,
          externalUrl: e.externalUrl,
          displayOrder: e.displayOrder ?? 0,
        })),
      };
    }
    // Le média n'est plus un champ du payload de révision (consolidation
    // Phase 2, Partie A) : il a son propre cycle upload → revue via le
    // module speaker-media (POST /speaker/me/media, statut PENDING_REVIEW →
    // APPROVED/REJECTED), indépendant du brouillon de profil.

    return data;
  }

  private async toDetailDtoWithDiff(
    revision: SpeakerRevisionRow,
  ): Promise<SpeakerRevisionDetailDto> {
    const speaker = await this.prisma.speaker.findUniqueOrThrow({
      where: { id: revision.speakerId },
      include: SPEAKER_DETAIL_INCLUDE,
    });
    const diff = await this.diffService.buildDiff(
      speaker,
      revision.payload as SpeakerRevisionPayloadDto,
    );

    return {
      id: revision.id,
      speaker: toSpeakerRef(revision.speaker),
      status: revision.status,
      payload: revision.payload as SpeakerRevisionPayloadDto,
      diff,
      submittedAt: revision.submittedAt,
      reviewedAt: revision.reviewedAt,
      reviewedBy: toAdminRef(revision.reviewedBy),
      reviewerComment: revision.reviewerComment,
      createdAt: revision.createdAt,
      updatedAt: revision.updatedAt,
    };
  }

  // ---------------------------------------------------------------------
  // Emails — un échec d'envoi ne doit jamais faire échouer l'opération en
  // base (cf. §8, même principe que Phase 1 booking-requests/roster-applications).
  // ---------------------------------------------------------------------

  private async sendTeamSubmittedNotification(
    revision: SpeakerRevisionRow,
    speaker: SpeakerDetailRow,
  ): Promise<void> {
    const teamEmail = this.config.get<string>('ASB_TEAM_EMAIL');
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    if (!teamEmail) {
      this.logger.warn(
        'ASB_TEAM_EMAIL absent : notification interne non envoyée.',
      );
      return;
    }
    try {
      await this.mailService.sendSpeakerRevisionTeamNotification({
        to: teamEmail,
        speakerName:
          speaker.publicName ?? `${speaker.firstName} ${speaker.lastName}`,
        backOfficeUrl: `${frontendUrl ?? ''}/speaker-revisions/${revision.id}`,
        relatedEntityId: revision.id,
      });
    } catch (error) {
      this.logger.error(
        `Échec de la notification interne pour la révision ${revision.id}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private async sendApprovedNotification(
    revision: SpeakerRevisionRow,
  ): Promise<void> {
    try {
      const email = await this.resolveSpeakerEmail(revision.speakerId);
      if (!email) return;
      await this.mailService.sendSpeakerRevisionApproved({
        to: email,
        speakerName: toSpeakerRef(revision.speaker).displayName,
        relatedEntityId: revision.id,
      });
    } catch (error) {
      this.logger.error(
        `Échec de l'email d'approbation pour la révision ${revision.id}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private async sendChangesRequestedNotification(
    revision: SpeakerRevisionRow,
  ): Promise<void> {
    try {
      const email = await this.resolveSpeakerEmail(revision.speakerId);
      if (!email) return;
      await this.mailService.sendSpeakerRevisionChangesRequested({
        to: email,
        speakerName: toSpeakerRef(revision.speaker).displayName,
        reviewerComment: revision.reviewerComment ?? '',
        relatedEntityId: revision.id,
      });
    } catch (error) {
      this.logger.error(
        `Échec de l'email de demande de correction pour la révision ${revision.id}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private async sendRejectedNotification(
    revision: SpeakerRevisionRow,
  ): Promise<void> {
    try {
      const email = await this.resolveSpeakerEmail(revision.speakerId);
      if (!email) return;
      await this.mailService.sendSpeakerRevisionRejected({
        to: email,
        speakerName: toSpeakerRef(revision.speaker).displayName,
        reviewerComment: revision.reviewerComment ?? '',
        relatedEntityId: revision.id,
      });
    } catch (error) {
      this.logger.error(
        `Échec de l'email de refus pour la révision ${revision.id}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private async resolveSpeakerEmail(speakerId: number): Promise<string | null> {
    const speaker = await this.prisma.speaker.findUnique({
      where: { id: speakerId },
      select: { email: true },
    });
    return speaker?.email ?? null;
  }
}
