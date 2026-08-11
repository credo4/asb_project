import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CuratedListStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { resolveUniqueCuratedListSlug } from './curated-list-slug.util';
import {
  CURATED_LIST_DETAIL_INCLUDE,
  CURATED_LIST_LIST_INCLUDE,
} from './curated-lists.includes';
import {
  scalarSnapshot,
  toDetailDto,
  toListItemDto,
} from './mappers/curated-list.mapper';
import { CreateCuratedListDto } from './dto/create-curated-list.dto';
import { UpdateCuratedListDto } from './dto/update-curated-list.dto';
import { UpdateCuratedListStatusDto } from './dto/update-curated-list-status.dto';
import { AddCuratedListMemberDto } from './dto/add-curated-list-member.dto';
import { ReorderCuratedListMembersDto } from './dto/reorder-curated-list-members.dto';
import { QueryCuratedListsDto } from './dto/query-curated-lists.dto';
import { CuratedListListResponseDto } from './dto/outputs/curated-list-list-item.dto';
import { CuratedListDetailDto } from './dto/outputs/curated-list-detail.dto';

@Injectable()
export class CuratedListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async findAll(
    query: QueryCuratedListsDto,
  ): Promise<CuratedListListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: Prisma.CuratedListWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.title = { contains: query.search };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.curatedList.count({ where }),
      this.prisma.curatedList.findMany({
        where,
        orderBy: { displayOrder: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: CURATED_LIST_LIST_INCLUDE,
      }),
    ]);

    return {
      data: rows.map(toListItemDto),
      meta: { total, page, perPage },
    };
  }

  async findOne(id: number): Promise<CuratedListDetailDto> {
    const row = await this.prisma.curatedList.findFirst({
      where: { id, deletedAt: null },
      include: CURATED_LIST_DETAIL_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Liste éditoriale ${id} introuvable.`);
    }
    return toDetailDto(row);
  }

  async create(
    dto: CreateCuratedListDto,
    actor: AuthenticatedUser,
  ): Promise<CuratedListDetailDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const slug = dto.slug
        ? await this.ensureSlugAvailable(tx, dto.slug)
        : await resolveUniqueCuratedListSlug(tx, dto.title);

      const list = await tx.curatedList.create({
        data: {
          title: dto.title,
          slug,
          description: dto.description,
          imageUrl: dto.imageUrl,
          displayOrder: dto.displayOrder ?? 0,
        },
        include: CURATED_LIST_DETAIL_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'curated_list.created',
        entityType: 'CuratedList',
        entityId: list.id,
        oldValue: null,
        newValue: scalarSnapshot(list),
      });

      return list;
    });

    return toDetailDto(created);
  }

  async update(
    id: number,
    dto: UpdateCuratedListDto,
    actor: AuthenticatedUser,
  ): Promise<CuratedListDetailDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.curatedList.findFirst({
        where: { id, deletedAt: null },
        include: CURATED_LIST_DETAIL_INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException(`Liste éditoriale ${id} introuvable.`);
      }

      let slug: string | undefined;
      if (dto.slug !== undefined && dto.slug !== existing.slug) {
        slug = await this.ensureSlugAvailable(tx, dto.slug, id);
      }

      const data: Prisma.CuratedListUncheckedUpdateInput = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (slug !== undefined) data.slug = slug;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
      if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;

      const list = await tx.curatedList.update({
        where: { id },
        data,
        include: CURATED_LIST_DETAIL_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'curated_list.updated',
        entityType: 'CuratedList',
        entityId: id,
        oldValue: scalarSnapshot(existing),
        newValue: scalarSnapshot(list),
      });

      return list;
    });

    return toDetailDto(updated);
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.curatedList.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException(`Liste éditoriale ${id} introuvable.`);
      }

      const deletedAt = new Date();
      await tx.curatedList.update({ where: { id }, data: { deletedAt } });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'curated_list.archived',
        entityType: 'CuratedList',
        entityId: id,
        oldValue: { deletedAt: null },
        newValue: { deletedAt: deletedAt.toISOString() },
      });
    });
  }

  // Workflow à 2 états seulement (§B3) — pas de matrice dédiée, la
  // validation directe suffit : DRAFT -> PUBLISHED (horodate publishedAt),
  // PUBLISHED -> DRAFT (dépublie, publishedAt inchangé — conservé comme
  // trace de la dernière publication, pratique courante côté CMS).
  async updateStatus(
    id: number,
    dto: UpdateCuratedListStatusDto,
    actor: AuthenticatedUser,
  ): Promise<CuratedListDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.curatedList.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Liste éditoriale ${id} introuvable.`);
      }
      if (existing.status === dto.status) {
        return; // no-op idempotent
      }

      const data: Prisma.CuratedListUncheckedUpdateInput = {
        status: dto.status,
      };
      if (dto.status === CuratedListStatus.PUBLISHED) {
        data.publishedAt = new Date();
      }

      const list = await tx.curatedList.update({ where: { id }, data });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'curated_list.status_changed',
        entityType: 'CuratedList',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: list.status },
      });
    });

    return this.findOne(id);
  }

  // §B — n'importe quel speaker peut être ajouté, quel que soit son statut
  // (voir AddCuratedListMemberDto) : la publication de la liste ne dépend
  // pas de celle de ses membres, seule la lecture PUBLIQUE filtre.
  async addMember(
    id: number,
    dto: AddCuratedListMemberDto,
    actor: AuthenticatedUser,
  ): Promise<CuratedListDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const list = await tx.curatedList.findFirst({
        where: { id, deletedAt: null },
      });
      if (!list) {
        throw new NotFoundException(`Liste éditoriale ${id} introuvable.`);
      }

      const speaker = await tx.speaker.findFirst({
        where: { id: dto.speakerId, deletedAt: null },
        select: { id: true },
      });
      if (!speaker) {
        throw new BadRequestException(`Speaker ${dto.speakerId} introuvable.`);
      }

      const existingMember = await tx.curatedListSpeaker.findUnique({
        where: {
          listId_speakerId: { listId: id, speakerId: dto.speakerId },
        },
      });
      if (existingMember) {
        throw new ConflictException(
          `Le speaker ${dto.speakerId} est déjà membre de cette liste.`,
        );
      }

      const maxOrder = await tx.curatedListSpeaker.aggregate({
        where: { listId: id },
        _max: { displayOrder: true },
      });
      const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;

      const member = await tx.curatedListSpeaker.create({
        data: { listId: id, speakerId: dto.speakerId, displayOrder: nextOrder },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'curated_list.member_added',
        entityType: 'CuratedList',
        entityId: id,
        oldValue: null,
        newValue: { speakerId: dto.speakerId, memberId: member.id },
      });
    });

    return this.findOne(id);
  }

  async removeMember(
    id: number,
    speakerId: number,
    actor: AuthenticatedUser,
  ): Promise<CuratedListDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const member = await tx.curatedListSpeaker.findUnique({
        where: { listId_speakerId: { listId: id, speakerId } },
      });
      if (!member) {
        throw new NotFoundException(
          `Le speaker ${speakerId} n'est pas membre de la liste ${id}.`,
        );
      }

      await tx.curatedListSpeaker.delete({ where: { id: member.id } });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'curated_list.member_removed',
        entityType: 'CuratedList',
        entityId: id,
        oldValue: { speakerId },
        newValue: null,
      });
    });

    return this.findOne(id);
  }

  // Même stratégie "permutation exacte" que SpeakerMediaService#reorderOwn.
  async reorderMembers(
    id: number,
    dto: ReorderCuratedListMembersDto,
    actor: AuthenticatedUser,
  ): Promise<CuratedListDetailDto> {
    const list = await this.prisma.curatedList.findFirst({
      where: { id, deletedAt: null },
    });
    if (!list) {
      throw new NotFoundException(`Liste éditoriale ${id} introuvable.`);
    }

    const existingMembers = await this.prisma.curatedListSpeaker.findMany({
      where: { listId: id },
      select: { speakerId: true },
    });
    const existingIds = existingMembers.map((m) => m.speakerId);
    const existingSet = new Set(existingIds);
    const submittedSet = new Set(dto.orderedSpeakerIds);
    const isSamePermutation =
      existingIds.length === dto.orderedSpeakerIds.length &&
      existingIds.every((sid) => submittedSet.has(sid)) &&
      dto.orderedSpeakerIds.every((sid) => existingSet.has(sid));

    if (!isSamePermutation) {
      throw new BadRequestException(
        "orderedSpeakerIds doit contenir exactement l'ensemble des membres actuels de cette liste, sans doublon ni omission.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [index, speakerId] of dto.orderedSpeakerIds.entries()) {
        await tx.curatedListSpeaker.update({
          where: { listId_speakerId: { listId: id, speakerId } },
          data: { displayOrder: index },
        });
      }

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'curated_list.members_reordered',
        entityType: 'CuratedList',
        entityId: id,
        oldValue: null,
        newValue: { orderedSpeakerIds: dto.orderedSpeakerIds },
      });
    });

    return this.findOne(id);
  }

  private async ensureSlugAvailable(
    tx: Prisma.TransactionClient,
    slug: string,
    excludeListId?: number,
  ): Promise<string> {
    const existing = await tx.curatedList.findFirst({
      where: {
        slug,
        ...(excludeListId ? { id: { not: excludeListId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Le slug "${slug}" est déjà utilisé par une autre liste éditoriale.`,
      );
    }
    return slug;
  }
}
