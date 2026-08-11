import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaReviewStatus, Prisma, SpeakerStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { CreateSpeakerDto } from './dto/create-speaker.dto';
import { UpdateSpeakerDto } from './dto/update-speaker.dto';
import { UpdateSpeakerStatusDto } from './dto/update-speaker-status.dto';
import {
  QuerySpeakersDto,
  SpeakerSortBy,
  SortOrder,
} from './dto/query-speakers.dto';
import { SpeakerListResponseDto } from './dto/speaker-list-item.dto';
import { SpeakerDetailDto } from './dto/speaker-detail.dto';
import { PricingInputDto } from './dto/inputs/pricing-input.dto';
import { EngagementInputDto } from './dto/inputs/engagement-input.dto';
import { MediaInputDto } from './dto/inputs/media-input.dto';
import {
  SPEAKER_DETAIL_INCLUDE,
  SPEAKER_LIST_INCLUDE,
  SpeakerDetailRow,
} from './speakers.includes';
import {
  toDetailDto,
  toListItemDto,
  toPricingDto,
} from './mappers/speaker.mapper';
import { resolveUniqueSlug } from './slug.util';
import { calculateCompletionScore } from './completion-score.util';
import {
  getMissingPublishRequirements,
  isTransitionAllowed,
} from './status-transitions.util';
import {
  assertPrimaryPillarCount,
  assertThemesMatchPillars,
} from './speaker-invariants.util';

@Injectable()
export class SpeakersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async findAll(query: QuerySpeakersDto): Promise<SpeakerListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where = this.buildWhere(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.speaker.count({ where }),
      this.prisma.speaker.findMany({
        where,
        orderBy: this.buildOrderBy(query),
        skip: (page - 1) * perPage,
        take: perPage,
        include: SPEAKER_LIST_INCLUDE,
      }),
    ]);

    return {
      data: rows.map(toListItemDto),
      meta: { total, page, perPage },
    };
  }

  async findOne(id: number): Promise<SpeakerDetailDto> {
    const speaker = await this.prisma.speaker.findFirst({
      where: { id, deletedAt: null },
      include: SPEAKER_DETAIL_INCLUDE,
    });
    if (!speaker) {
      throw new NotFoundException(`Speaker ${id} introuvable.`);
    }
    return toDetailDto(speaker);
  }

  async create(
    dto: CreateSpeakerDto,
    actor: AuthenticatedUser,
  ): Promise<SpeakerDetailDto> {
    assertPrimaryPillarCount(dto.pillars);

    const created = await this.prisma.$transaction(async (tx) => {
      const pillarIds = (dto.pillars ?? []).map((p) => p.pillarId);
      await assertThemesMatchPillars(tx, dto.themeIds ?? [], pillarIds);

      const slug = dto.slug
        ? await this.ensureSlugAvailable(tx, dto.slug)
        : await resolveUniqueSlug(
            tx,
            dto.publicName ?? `${dto.firstName} ${dto.lastName}`,
          );

      const speaker = await tx.speaker.create({
        data: this.buildCreateData(dto, slug, actor),
        include: SPEAKER_DETAIL_INCLUDE,
      });

      const finalSpeaker = await tx.speaker.update({
        where: { id: speaker.id },
        data: { completionScore: calculateCompletionScore(speaker) },
        include: SPEAKER_DETAIL_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker.created',
        entityType: 'Speaker',
        entityId: finalSpeaker.id,
        oldValue: null,
        newValue: this.scalarSnapshot(finalSpeaker),
      });

      return finalSpeaker;
    });

    return toDetailDto(created);
  }

  async update(
    id: number,
    dto: UpdateSpeakerDto,
    actor: AuthenticatedUser,
  ): Promise<SpeakerDetailDto> {
    if (dto.pillars) {
      assertPrimaryPillarCount(dto.pillars);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.speaker.findFirst({
        where: { id, deletedAt: null },
        include: SPEAKER_DETAIL_INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException(`Speaker ${id} introuvable.`);
      }

      if (dto.pillars || dto.themeIds) {
        const effectivePillarIds = dto.pillars
          ? dto.pillars.map((p) => p.pillarId)
          : existing.pillars.map((p) => p.pillarId);
        const effectiveThemeIds =
          dto.themeIds ?? existing.themes.map((t) => t.themeId);
        await assertThemesMatchPillars(
          tx,
          effectiveThemeIds,
          effectivePillarIds,
        );
      }

      let slug: string | undefined;
      if (dto.slug !== undefined && dto.slug !== existing.slug) {
        slug = await this.ensureSlugAvailable(tx, dto.slug, id);
      }

      const speaker = await tx.speaker.update({
        where: { id },
        data: this.buildUpdateData(dto, slug, actor),
        include: SPEAKER_DETAIL_INCLUDE,
      });

      const completionScore = calculateCompletionScore(speaker);
      const finalSpeaker =
        completionScore === speaker.completionScore
          ? speaker
          : await tx.speaker.update({
              where: { id },
              data: { completionScore },
              include: SPEAKER_DETAIL_INCLUDE,
            });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker.updated',
        entityType: 'Speaker',
        entityId: id,
        oldValue: this.scalarSnapshot(existing),
        newValue: this.scalarSnapshot(finalSpeaker),
      });

      if (dto.pricing) {
        await this.activityLog.record(tx, {
          actorId: actor.id,
          action: 'speaker.pricing_updated',
          entityType: 'Speaker',
          entityId: id,
          oldValue: toPricingDto(existing.pricing),
          newValue: toPricingDto(finalSpeaker.pricing),
        });
      }

      return finalSpeaker;
    });

    return toDetailDto(updated);
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.speaker.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException(`Speaker ${id} introuvable.`);
      }

      const deletedAt = new Date();
      // isVisible: false en plus de deletedAt — défense en profondeur, au cas
      // où une future requête publique oublierait de filtrer deletedAt.
      await tx.speaker.update({
        where: { id },
        data: { deletedAt, isVisible: false },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker.archived',
        entityType: 'Speaker',
        entityId: id,
        oldValue: { deletedAt: null },
        newValue: { deletedAt: deletedAt.toISOString() },
      });
    });
  }

  async updateStatus(
    id: number,
    dto: UpdateSpeakerStatusDto,
    actor: AuthenticatedUser,
  ): Promise<SpeakerDetailDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.speaker.findFirst({
        where: { id, deletedAt: null },
        include: SPEAKER_DETAIL_INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException(`Speaker ${id} introuvable.`);
      }

      if (!isTransitionAllowed(existing.status, dto.status)) {
        throw new BadRequestException(
          `Transition de statut refusée : "${existing.status}" -> "${dto.status}".`,
        );
      }

      if (dto.status === SpeakerStatus.PUBLISHED) {
        const missing = getMissingPublishRequirements(existing);
        if (missing.length > 0) {
          throw new BadRequestException(
            `Impossible de publier ce speaker, champs manquants : ${missing.join(', ')}.`,
          );
        }
      }

      const data: Prisma.SpeakerUncheckedUpdateInput = { status: dto.status };
      if (dto.status === SpeakerStatus.PUBLISHED) {
        data.publishedAt = new Date();
        data.isVisible = true;
      } else if (
        dto.status === SpeakerStatus.UNPUBLISHED ||
        dto.status === SpeakerStatus.SUSPENDED ||
        dto.status === SpeakerStatus.ARCHIVED
      ) {
        data.isVisible = false;
      }

      const speaker = await tx.speaker.update({
        where: { id },
        data,
        include: SPEAKER_DETAIL_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker.status_changed',
        entityType: 'Speaker',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: speaker.status },
      });

      return speaker;
    });

    return toDetailDto(updated);
  }

  // ---------------------------------------------------------------------
  // Filtres / tri
  // ---------------------------------------------------------------------

  private buildWhere(query: QuerySpeakersDto): Prisma.SpeakerWhereInput {
    const where: Prisma.SpeakerWhereInput = { deletedAt: null };

    if (query.search) {
      const search = query.search;
      // Pas de `mode: 'insensitive'` : option Postgres/Mongo uniquement,
      // non supportée par le provider MySQL (déjà insensible à la casse
      // par défaut via sa collation utf8mb4_general_ci).
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { publicName: { contains: search } },
        { professionalTitle: { contains: search } },
        { keywords: { some: { keyword: { contains: search } } } },
      ];
    }
    if (query.pillarId) {
      where.pillars = { some: { pillarId: query.pillarId } };
    }
    if (query.themeId) {
      where.themes = { some: { themeId: query.themeId } };
    }
    if (query.countryId) {
      where.countryId = query.countryId;
    }
    if (query.languageId) {
      where.languages = { some: { languageId: query.languageId } };
    }
    if (query.formatId) {
      where.formats = { some: { formatId: query.formatId } };
    }
    if (query.feeTierPublic) {
      where.feeTierPublic = query.feeTierPublic;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.isFeaturedHome !== undefined) {
      where.isFeaturedHome = query.isFeaturedHome;
    }
    if (query.isTopRequested !== undefined) {
      where.isTopRequested = query.isTopRequested;
    }

    return where;
  }

  private buildOrderBy(
    query: QuerySpeakersDto,
  ): Prisma.SpeakerOrderByWithRelationInput[] {
    const order = query.sortOrder ?? SortOrder.DESC;
    switch (query.sortBy) {
      case SpeakerSortBy.NAME:
        return [{ lastName: order }, { firstName: order }];
      case SpeakerSortBy.CREATED_AT:
        return [{ createdAt: order }];
      case SpeakerSortBy.UPDATED_AT:
      default:
        return [{ updatedAt: order }];
    }
  }

  // ---------------------------------------------------------------------
  // Règles métier — assertPrimaryPillarCount/assertThemesMatchPillars sont
  // partagées avec SpeakerRevisionsService (voir speaker-invariants.util.ts) :
  // un seul jeu de règles pour les deux chemins qui écrivent dans `speakers`.
  // ---------------------------------------------------------------------

  private async ensureSlugAvailable(
    tx: Prisma.TransactionClient,
    slug: string,
    excludeSpeakerId?: number,
  ): Promise<string> {
    const existing = await tx.speaker.findFirst({
      where: {
        slug,
        ...(excludeSpeakerId ? { id: { not: excludeSpeakerId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Le slug "${slug}" est déjà utilisé par un autre speaker.`,
      );
    }
    return slug;
  }

  // ---------------------------------------------------------------------
  // Construction des payloads Prisma (scalaires + relations)
  // ---------------------------------------------------------------------

  private buildCreateData(
    dto: CreateSpeakerDto,
    slug: string,
    actor: AuthenticatedUser,
  ): Prisma.SpeakerUncheckedCreateInput {
    return {
      civility: dto.civility,
      firstName: dto.firstName,
      lastName: dto.lastName,
      publicName: dto.publicName,
      email: dto.email,
      phone: dto.phone,
      countryId: dto.countryId,
      nationalityCountryId: dto.nationalityCountryId,
      city: dto.city,
      timezone: dto.timezone,
      slug,
      profilePhotoUrl: dto.profilePhotoUrl,
      coverPhotoUrl: dto.coverPhotoUrl,
      professionalTitle: dto.professionalTitle,
      currentOrganization: dto.currentOrganization,
      currentPosition: dto.currentPosition,
      websiteUrl: dto.websiteUrl,
      linkedinUrl: dto.linkedinUrl,
      socialLinks: dto.socialLinks as Prisma.InputJsonValue | undefined,
      shortBio: dto.shortBio,
      fullBio: dto.fullBio,
      quote: dto.quote,
      expertiseSummary: dto.expertiseSummary,
      valueProposition: dto.valueProposition,
      careerPath: dto.careerPath,
      keyAchievements: dto.keyAchievements,
      awards: dto.awards,
      feeTierPublic: dto.feeTierPublic,
      isFeaturedHome: dto.isFeaturedHome,
      isTopRequested: dto.isTopRequested,
      showBudget: dto.showBudget,
      showLocation: dto.showLocation,
      allowIndexing: dto.allowIndexing,
      pillars: dto.pillars?.length
        ? {
            create: dto.pillars.map((p) => ({
              pillarId: p.pillarId,
              isPrimary: p.isPrimary ?? false,
              displayOrder: p.displayOrder ?? 0,
            })),
          }
        : undefined,
      themes: dto.themeIds?.length
        ? { create: dto.themeIds.map((themeId) => ({ themeId })) }
        : undefined,
      keywords: dto.keywords?.length
        ? { create: dto.keywords.map((keyword) => ({ keyword })) }
        : undefined,
      formats: dto.formatIds?.length
        ? { create: dto.formatIds.map((formatId) => ({ formatId })) }
        : undefined,
      languages: dto.languages?.length
        ? { create: dto.languages.map((l) => this.languageCreateData(l)) }
        : undefined,
      pricing: dto.pricing
        ? { create: this.pricingCreateData(dto.pricing) }
        : undefined,
      engagements: dto.engagements?.length
        ? { create: dto.engagements.map((e) => this.engagementCreateData(e)) }
        : undefined,
      media: dto.media?.length
        ? { create: dto.media.map((m) => this.mediaCreateData(m, actor)) }
        : undefined,
    };
  }

  private buildUpdateData(
    dto: UpdateSpeakerDto,
    slug: string | undefined,
    actor: AuthenticatedUser,
  ): Prisma.SpeakerUncheckedUpdateInput {
    return {
      civility: dto.civility,
      firstName: dto.firstName,
      lastName: dto.lastName,
      publicName: dto.publicName,
      email: dto.email,
      phone: dto.phone,
      countryId: dto.countryId,
      nationalityCountryId: dto.nationalityCountryId,
      city: dto.city,
      timezone: dto.timezone,
      slug,
      profilePhotoUrl: dto.profilePhotoUrl,
      coverPhotoUrl: dto.coverPhotoUrl,
      professionalTitle: dto.professionalTitle,
      currentOrganization: dto.currentOrganization,
      currentPosition: dto.currentPosition,
      websiteUrl: dto.websiteUrl,
      linkedinUrl: dto.linkedinUrl,
      socialLinks: dto.socialLinks as Prisma.InputJsonValue | undefined,
      shortBio: dto.shortBio,
      fullBio: dto.fullBio,
      quote: dto.quote,
      expertiseSummary: dto.expertiseSummary,
      valueProposition: dto.valueProposition,
      careerPath: dto.careerPath,
      keyAchievements: dto.keyAchievements,
      awards: dto.awards,
      feeTierPublic: dto.feeTierPublic,
      isFeaturedHome: dto.isFeaturedHome,
      isTopRequested: dto.isTopRequested,
      showBudget: dto.showBudget,
      showLocation: dto.showLocation,
      allowIndexing: dto.allowIndexing,
      // Stratégie de remplacement explicite : `deleteMany({})` purge toutes
      // les lignes de jonction existantes pour CE speaker (Prisma la scope
      // automatiquement via la relation), puis `create` réinsère la
      // nouvelle liste. Une clé absente du DTO (`undefined`) ne touche pas
      // du tout la relation existante.
      pillars: dto.pillars
        ? {
            deleteMany: {},
            create: dto.pillars.map((p) => ({
              pillarId: p.pillarId,
              isPrimary: p.isPrimary ?? false,
              displayOrder: p.displayOrder ?? 0,
            })),
          }
        : undefined,
      themes: dto.themeIds
        ? {
            deleteMany: {},
            create: dto.themeIds.map((themeId) => ({ themeId })),
          }
        : undefined,
      keywords: dto.keywords
        ? {
            deleteMany: {},
            create: dto.keywords.map((keyword) => ({ keyword })),
          }
        : undefined,
      formats: dto.formatIds
        ? {
            deleteMany: {},
            create: dto.formatIds.map((formatId) => ({ formatId })),
          }
        : undefined,
      languages: dto.languages
        ? {
            deleteMany: {},
            create: dto.languages.map((l) => this.languageCreateData(l)),
          }
        : undefined,
      pricing: dto.pricing
        ? {
            upsert: {
              create: this.pricingCreateData(dto.pricing),
              update: this.pricingCreateData(dto.pricing),
            },
          }
        : undefined,
      engagements: dto.engagements
        ? {
            deleteMany: {},
            create: dto.engagements.map((e) => this.engagementCreateData(e)),
          }
        : undefined,
      media: dto.media
        ? {
            deleteMany: {},
            create: dto.media.map((m) => this.mediaCreateData(m, actor)),
          }
        : undefined,
    };
  }

  private languageCreateData(input: {
    languageId: number;
    proficiency?: Prisma.SpeakerLanguageUncheckedCreateInput['proficiency'];
    canPresent?: boolean;
    canQa?: boolean;
    canModerate?: boolean;
  }) {
    return {
      languageId: input.languageId,
      proficiency: input.proficiency,
      canPresent: input.canPresent,
      canQa: input.canQa,
      canModerate: input.canModerate,
    };
  }

  private pricingCreateData(input: PricingInputDto) {
    return {
      currency: input.currency ?? 'USD',
      minFee: input.minFee,
      recommendedFee: input.recommendedFee,
      feeKeynote: input.feeKeynote,
      feePanel: input.feePanel,
      feeWebinar: input.feeWebinar,
      feeMasterclass: input.feeMasterclass,
      feeAdvisory: input.feeAdvisory,
      feeOneToOne: input.feeOneToOne,
      travelFees: input.travelFees,
      negotiationTerms: input.negotiationTerms,
      agencyCommission: input.agencyCommission,
      internalNotes: input.internalNotes,
    };
  }

  private engagementCreateData(input: EngagementInputDto) {
    return {
      eventName: input.eventName,
      organization: input.organization,
      countryId: input.countryId,
      eventDate: input.eventDate ? new Date(input.eventDate) : undefined,
      dateLabel: input.dateLabel,
      role: input.role,
      topic: input.topic,
      description: input.description,
      photoUrl: input.photoUrl,
      videoUrl: input.videoUrl,
      externalUrl: input.externalUrl,
      displayOrder: input.displayOrder ?? 0,
    };
  }

  // Un média créé/modifié par un ADMIN/SUPER_ADMIN via ce CRUD est écrit
  // directement en APPROVED — il ne s'auto-valide pas via la file de revue
  // (/admin/speaker-media), mais son écriture directe par un rôle habilité
  // vaut approbation immédiate (consolidation Phase 2, Partie A).
  private mediaCreateData(input: MediaInputDto, actor: AuthenticatedUser) {
    return {
      type: input.type,
      title: input.title,
      caption: input.caption,
      url: input.url,
      thumbnailUrl: input.thumbnailUrl,
      displayOrder: input.displayOrder ?? 0,
      status: MediaReviewStatus.APPROVED,
      reviewedAt: new Date(),
      reviewedById: actor.id,
    };
  }

  // Résumé volontairement restreint (pas les relations, pas les champs
  // texte longs) : le journal sert à un audit humain, pas à un diff complet.
  private scalarSnapshot(speaker: SpeakerDetailRow): Record<string, unknown> {
    return {
      id: speaker.id,
      firstName: speaker.firstName,
      lastName: speaker.lastName,
      publicName: speaker.publicName,
      status: speaker.status,
      slug: speaker.slug,
      isVisible: speaker.isVisible,
      completionScore: speaker.completionScore,
      feeTierPublic: speaker.feeTierPublic,
      updatedAt: speaker.updatedAt,
    };
  }
}
