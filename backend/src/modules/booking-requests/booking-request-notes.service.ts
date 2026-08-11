import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { sanitizeText } from '../../common/utils/sanitize-text.util';
import { BookingRequestsService } from './booking-requests.service';
import { CreateBookingRequestNoteDto } from './dto/create-booking-request-note.dto';
import { BookingRequestNoteDto } from './dto/outputs/booking-request-note.dto';
import { toNoteDto } from './mappers/booking-request.mapper';

const NOTE_ADMIN_INCLUDE = {
  author: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} as const;

// AJOUT SEUL (§2.3) : pas de méthode `update`, volontairement. Deux admins
// qui écrivent "en même temps" produisent deux lignes distinctes, jamais un
// écrasement — c'est tout l'intérêt de ce modèle par rapport à l'ancien
// champ texte unique `internalNotes` (supprimé, voir schema.prisma).
@Injectable()
export class BookingRequestNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly bookingRequests: BookingRequestsService,
  ) {}

  async create(
    requestId: number,
    dto: CreateBookingRequestNoteDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestNoteDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.bookingRequest.findUnique({
        where: { id: requestId },
        select: { id: true },
      });
      if (!request) {
        throw new NotFoundException(`Demande ${requestId} introuvable.`);
      }

      const row = await tx.bookingRequestNote.create({
        data: {
          requestId,
          authorId: actor.id,
          body: sanitizeText(dto.body),
        },
        include: NOTE_ADMIN_INCLUDE,
      });

      // §2.5 — la première note interne compte comme "première réponse" au
      // même titre que la première transition hors NEW (le premier des deux
      // événements l'emporte) — voir BookingRequestsService#updateStatus.
      await this.bookingRequests.markFirstRespondedIfNeeded(tx, requestId);

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request.note_added',
        entityType: 'BookingRequest',
        entityId: requestId,
        oldValue: null,
        newValue: { noteId: row.id },
      });

      return row;
    });

    return toNoteDto(created);
  }

  // Suppression réservée à l'auteur ou à un SUPER_ADMIN (§2.3), en soft
  // delete, journalisée.
  async remove(
    requestId: number,
    noteId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookingRequestNote.findFirst({
        where: { id: noteId, requestId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Note ${noteId} introuvable.`);
      }
      if (existing.authorId !== actor.id && actor.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Seul l’auteur de la note ou un SUPER_ADMIN peut la supprimer.',
        );
      }

      const deletedAt = new Date();
      await tx.bookingRequestNote.update({
        where: { id: noteId },
        data: { deletedAt },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request.note_deleted',
        entityType: 'BookingRequest',
        entityId: requestId,
        oldValue: { noteId, deletedAt: null },
        newValue: { noteId, deletedAt: deletedAt.toISOString() },
      });
    });
  }
}
