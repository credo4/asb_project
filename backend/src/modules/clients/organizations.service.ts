import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import {
  sanitizeOptionalText,
  sanitizeText,
} from '../../common/utils/sanitize-text.util';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { QueryOrganizationsDto } from './dto/query-organizations.dto';
import { SuggestOrganizationsDto } from './dto/suggest-organizations.dto';
import { OrganizationListResponseDto } from './dto/outputs/organization-list-item.dto';
import { OrganizationDetailDto } from './dto/outputs/organization-detail.dto';
import { OrganizationSuggestionDto } from './dto/outputs/organization-suggestion.dto';
import {
  ORGANIZATION_DETAIL_INCLUDE,
  ORGANIZATION_LIST_INCLUDE,
} from './clients.includes';
import {
  scalarSnapshot,
  toDetailDto,
  toListItemDto,
} from './mappers/organization.mapper';

// Fusion de doublons (organisation A absorbe organisation B) : HORS
// PÉRIMÈTRE de cette étape (Phase 3, §3a — voir le prompt de spec). Un
// endpoint de fusion sera nécessaire plus tard ; pas construit ici.
const SUGGEST_LIMIT = 10;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async findAll(
    query: QueryOrganizationsDto,
  ): Promise<OrganizationListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where = this.buildWhere(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: ORGANIZATION_LIST_INCLUDE,
      }),
    ]);

    return {
      data: rows.map(toListItemDto),
      meta: { total, page, perPage },
    };
  }

  async findOne(id: number): Promise<OrganizationDetailDto> {
    const row = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      include: ORGANIZATION_DETAIL_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Organisation ${id} introuvable.`);
    }
    return toDetailDto(row);
  }

  async suggest(
    query: SuggestOrganizationsDto,
  ): Promise<OrganizationSuggestionDto[]> {
    const rows = await this.prisma.organization.findMany({
      where: { name: { contains: query.name }, deletedAt: null },
      orderBy: { name: 'asc' },
      take: SUGGEST_LIMIT,
      select: { id: true, name: true, sector: true },
    });
    return rows;
  }

  async create(
    dto: CreateOrganizationDto,
    actor: AuthenticatedUser,
  ): Promise<OrganizationDetailDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.organization.create({
        data: {
          name: sanitizeText(dto.name),
          sector: sanitizeOptionalText(dto.sector),
          countryId: dto.countryId,
          website: dto.website,
          internalNotes: sanitizeOptionalText(dto.internalNotes),
          assignedAdminId: dto.assignedAdminId,
        },
        include: ORGANIZATION_DETAIL_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'organization.created',
        entityType: 'Organization',
        entityId: row.id,
        oldValue: null,
        newValue: scalarSnapshot(row),
      });

      return row;
    });

    return toDetailDto(created);
  }

  async update(
    id: number,
    dto: UpdateOrganizationDto,
    actor: AuthenticatedUser,
  ): Promise<OrganizationDetailDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.organization.findFirst({
        where: { id, deletedAt: null },
        include: ORGANIZATION_DETAIL_INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException(`Organisation ${id} introuvable.`);
      }

      const data: Prisma.OrganizationUncheckedUpdateInput = {};
      if (dto.name !== undefined) data.name = sanitizeText(dto.name);
      if (dto.sector !== undefined) {
        data.sector = sanitizeOptionalText(dto.sector);
      }
      if (dto.countryId !== undefined) data.countryId = dto.countryId;
      if (dto.website !== undefined) data.website = dto.website;
      if (dto.internalNotes !== undefined) {
        data.internalNotes = sanitizeOptionalText(dto.internalNotes);
      }
      if (dto.assignedAdminId !== undefined) {
        data.assignedAdminId = dto.assignedAdminId;
      }

      const row = await tx.organization.update({
        where: { id },
        data,
        include: ORGANIZATION_DETAIL_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'organization.updated',
        entityType: 'Organization',
        entityId: id,
        oldValue: scalarSnapshot(existing),
        newValue: scalarSnapshot(row),
      });

      return row;
    });

    return toDetailDto(updated);
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.organization.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException(`Organisation ${id} introuvable.`);
      }

      const deletedAt = new Date();
      await tx.organization.update({ where: { id }, data: { deletedAt } });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'organization.deleted',
        entityType: 'Organization',
        entityId: id,
        oldValue: { deletedAt: null },
        newValue: { deletedAt: deletedAt.toISOString() },
      });
    });
  }

  private buildWhere(
    query: QueryOrganizationsDto,
  ): Prisma.OrganizationWhereInput {
    const where: Prisma.OrganizationWhereInput = { deletedAt: null };

    if (query.search) {
      where.OR = [{ name: { contains: query.search } }];
    }
    if (query.sector) where.sector = { contains: query.sector };
    if (query.countryId) where.countryId = query.countryId;
    if (query.assignedAdminId) where.assignedAdminId = query.assignedAdminId;

    return where;
  }
}
