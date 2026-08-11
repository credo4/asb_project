import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import {
  sanitizeOptionalText,
  sanitizeText,
} from '../../common/utils/sanitize-text.util';
import { normalizeEmail } from './email-normalize.util';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { ContactListResponseDto } from './dto/outputs/contact-list-item.dto';
import { ContactDetailDto } from './dto/outputs/contact-detail.dto';
import {
  CONTACT_DETAIL_INCLUDE,
  CONTACT_LIST_INCLUDE,
} from './clients.includes';
import {
  scalarSnapshot,
  toDetailDto,
  toListItemDto,
} from './mappers/contact.mapper';

const DUPLICATE_EMAIL_MESSAGE =
  'Un contact avec cet email existe déjà (voir aussi PATCH /admin/booking-requests/:id/link pour rattacher plutôt que dupliquer).';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async findAll(query: QueryContactsDto): Promise<ContactListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where = this.buildWhere(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        include: CONTACT_LIST_INCLUDE,
      }),
    ]);

    return {
      data: rows.map(toListItemDto),
      meta: { total, page, perPage },
    };
  }

  async findOne(id: number): Promise<ContactDetailDto> {
    const row = await this.prisma.contact.findFirst({
      where: { id, deletedAt: null },
      include: CONTACT_DETAIL_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(`Contact ${id} introuvable.`);
    }
    return toDetailDto(row);
  }

  async create(
    dto: CreateContactDto,
    actor: AuthenticatedUser,
  ): Promise<ContactDetailDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      let row;
      try {
        row = await tx.contact.create({
          data: {
            firstName: sanitizeText(dto.firstName),
            lastName: sanitizeText(dto.lastName),
            email: dto.email,
            normalizedEmail: normalizeEmail(dto.email),
            phone: sanitizeOptionalText(dto.phone),
            jobTitle: sanitizeOptionalText(dto.jobTitle),
            organizationId: dto.organizationId,
            countryId: dto.countryId,
            internalNotes: sanitizeOptionalText(dto.internalNotes),
          },
          include: CONTACT_DETAIL_INCLUDE,
        });
      } catch (error) {
        throw this.mapDuplicateEmailError(error);
      }

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'contact.created',
        entityType: 'Contact',
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
    dto: UpdateContactDto,
    actor: AuthenticatedUser,
  ): Promise<ContactDetailDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.contact.findFirst({
        where: { id, deletedAt: null },
        include: CONTACT_DETAIL_INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException(`Contact ${id} introuvable.`);
      }

      const data: Prisma.ContactUncheckedUpdateInput = {};
      if (dto.firstName !== undefined)
        data.firstName = sanitizeText(dto.firstName);
      if (dto.lastName !== undefined)
        data.lastName = sanitizeText(dto.lastName);
      if (dto.email !== undefined) {
        data.email = dto.email;
        data.normalizedEmail = normalizeEmail(dto.email);
      }
      if (dto.phone !== undefined) data.phone = sanitizeOptionalText(dto.phone);
      if (dto.jobTitle !== undefined) {
        data.jobTitle = sanitizeOptionalText(dto.jobTitle);
      }
      if (dto.organizationId !== undefined) {
        data.organizationId = dto.organizationId;
      }
      if (dto.countryId !== undefined) data.countryId = dto.countryId;
      if (dto.internalNotes !== undefined) {
        data.internalNotes = sanitizeOptionalText(dto.internalNotes);
      }

      let row;
      try {
        row = await tx.contact.update({
          where: { id },
          data,
          include: CONTACT_DETAIL_INCLUDE,
        });
      } catch (error) {
        throw this.mapDuplicateEmailError(error);
      }

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'contact.updated',
        entityType: 'Contact',
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
      const existing = await tx.contact.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException(`Contact ${id} introuvable.`);
      }

      const deletedAt = new Date();
      // normalizedEmail -> NULL EN MÊME TEMPS que le soft delete : c'est ce
      // qui libère l'email pour une nouvelle fiche (voir le commentaire sur
      // Contact.normalizedEmail dans schema.prisma, et le test e2e dédié).
      await tx.contact.update({
        where: { id },
        data: { deletedAt, normalizedEmail: null },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'contact.deleted',
        entityType: 'Contact',
        entityId: id,
        oldValue: { deletedAt: null },
        newValue: { deletedAt: deletedAt.toISOString() },
      });
    });
  }

  private mapDuplicateEmailError(error: unknown): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(DUPLICATE_EMAIL_MESSAGE);
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  private buildWhere(query: QueryContactsDto): Prisma.ContactWhereInput {
    const where: Prisma.ContactWhereInput = { deletedAt: null };

    if (query.search) {
      const search = query.search;
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (query.countryId) where.countryId = query.countryId;
    if (query.organizationId) where.organizationId = query.organizationId;

    return where;
  }
}
