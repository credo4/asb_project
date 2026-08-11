import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { sanitizeText } from '../../common/utils/sanitize-text.util';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ReminderDto } from './dto/outputs/reminder.dto';

const REMINDER_ADMIN_INCLUDE = {
  assignedTo: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  createdBy: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} as const;

function toReminderDto(row: {
  id: number;
  dueAt: Date;
  assignedTo: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  message: string;
  doneAt: Date | null;
  createdBy: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  createdAt: Date;
}): ReminderDto {
  return {
    id: row.id,
    dueAt: row.dueAt,
    assignedTo: row.assignedTo,
    message: row.message,
    doneAt: row.doneAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async listForRequest(requestId: number): Promise<ReminderDto[]> {
    const exists = await this.prisma.bookingRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Demande ${requestId} introuvable.`);
    }

    const rows = await this.prisma.reminder.findMany({
      where: { requestId },
      orderBy: { dueAt: 'asc' },
      include: REMINDER_ADMIN_INCLUDE,
    });
    return rows.map(toReminderDto);
  }

  async create(
    requestId: number,
    dto: CreateReminderDto,
    actor: AuthenticatedUser,
  ): Promise<ReminderDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.bookingRequest.findUnique({
        where: { id: requestId },
        select: { id: true },
      });
      if (!request) {
        throw new NotFoundException(`Demande ${requestId} introuvable.`);
      }

      const row = await tx.reminder.create({
        data: {
          requestId,
          dueAt: new Date(dto.dueAt),
          assignedToId: dto.assignedToId,
          message: sanitizeText(dto.message),
          createdById: actor.id,
        },
        include: REMINDER_ADMIN_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request.reminder_created',
        entityType: 'BookingRequest',
        entityId: requestId,
        oldValue: null,
        newValue: { reminderId: row.id, dueAt: row.dueAt.toISOString() },
      });

      return row;
    });

    return toReminderDto(created);
  }

  async markDone(
    requestId: number,
    reminderId: number,
    actor: AuthenticatedUser,
  ): Promise<ReminderDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.reminder.findFirst({
        where: { id: reminderId, requestId },
      });
      if (!existing) {
        throw new NotFoundException(`Rappel ${reminderId} introuvable.`);
      }

      const row = await tx.reminder.update({
        where: { id: reminderId },
        data: { doneAt: new Date() },
        include: REMINDER_ADMIN_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request.reminder_done',
        entityType: 'BookingRequest',
        entityId: requestId,
        oldValue: { reminderId, doneAt: null },
        newValue: { reminderId, doneAt: row.doneAt?.toISOString() },
      });

      return row;
    });

    return toReminderDto(updated);
  }

  // Utilisé par RemindersScheduler (§2.6) — rappels échus, PAS encore
  // marqués "fait". Choix délibéré, documenté : la table ne porte qu'un
  // `doneAt` (pas de colonne "déjà notifié"), donc un rappel échu est
  // ré-envoyé à CHAQUE passage horaire tant qu'il n'est pas marqué fait —
  // un rappel qui "insiste" toutes les heures jusqu'à traitement explicite
  // est un comportement voulu, pas un bug, et évite d'ajouter une colonne
  // non spécifiée par le prompt.
  async findDue(now: Date) {
    return this.prisma.reminder.findMany({
      where: { dueAt: { lte: now }, doneAt: null },
      include: {
        assignedTo: { select: { id: true, email: true } },
        request: { select: { id: true, reference: true } },
      },
    });
  }
}
