import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingRequestSpeakerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { sanitizeOptionalText } from '../../common/utils/sanitize-text.util';
import { AddBookingRequestSpeakerDto } from './dto/add-booking-request-speaker.dto';
import { UpdateBookingRequestSpeakerStatusDto } from './dto/update-booking-request-speaker-status.dto';
import { ReorderBookingRequestSpeakersDto } from './dto/reorder-booking-request-speakers.dto';
import { ReplaceBookingRequestSpeakerDto } from './dto/replace-booking-request-speaker.dto';
import { BookingRequestSpeakerDto } from './dto/outputs/booking-request-speaker.dto';
import {
  getAllowedBookingRequestSpeakerTransitions,
  isBookingRequestSpeakerTransitionAllowed,
} from './booking-request-speaker-status-transitions.util';

const SELECT = {
  id: true,
  status: true,
  displayOrder: true,
  internalNotes: true,
  proposedToClientAt: true,
  addedAt: true,
  addedBy: { select: { email: true } },
  speaker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      publicName: true,
      slug: true,
      profilePhotoUrl: true,
    },
  },
} satisfies Prisma.BookingRequestSpeakerSelect;

type Row = Prisma.BookingRequestSpeakerGetPayload<{ select: typeof SELECT }>;

@Injectable()
export class BookingRequestSpeakersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async findAll(requestId: number): Promise<BookingRequestSpeakerDto[]> {
    await this.assertBookingRequestExists(requestId);
    const rows = await this.prisma.bookingRequestSpeaker.findMany({
      where: { requestId, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
      select: SELECT,
    });
    return rows.map(toDto);
  }

  // Idempotent/réactivant plutôt qu'un simple `create` (voir le commentaire
  // sur `@@unique([requestId, speakerId])` dans schema.prisma) : la paire
  // est unique sur TOUTES les lignes, y compris soft-supprimées ou
  // WITHDRAWN — un ré-ajout après retrait doit donc réactiver la ligne
  // existante, jamais tenter d'en créer une seconde (qui violerait la
  // contrainte). 409 UNIQUEMENT si le speaker est déjà activement dans la
  // sélection.
  async add(
    requestId: number,
    dto: AddBookingRequestSpeakerDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestSpeakerDto> {
    await this.assertBookingRequestExists(requestId);
    await this.assertSpeakerExists(dto.speakerId);

    const row = await this.prisma.$transaction((tx) =>
      this.addOrReactivate(
        tx,
        requestId,
        dto.speakerId,
        dto.internalNotes,
        actor,
      ),
    );

    return toDto(row);
  }

  async remove(
    requestId: number,
    speakerId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookingRequestSpeaker.findFirst({
        where: { requestId, speakerId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(
          `Speaker ${speakerId} introuvable dans la sélection de la demande ${requestId}.`,
        );
      }

      const deletedAt = new Date();
      await tx.bookingRequestSpeaker.update({
        where: { id: existing.id },
        data: { deletedAt },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request_speaker.removed',
        entityType: 'BookingRequestSpeaker',
        entityId: existing.id,
        oldValue: { deletedAt: null },
        newValue: { deletedAt: deletedAt.toISOString() },
      });
    });
  }

  async updateStatus(
    requestId: number,
    speakerId: number,
    dto: UpdateBookingRequestSpeakerStatusDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestSpeakerDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookingRequestSpeaker.findFirst({
        where: { requestId, speakerId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(
          `Speaker ${speakerId} introuvable dans la sélection de la demande ${requestId}.`,
        );
      }

      if (
        !isBookingRequestSpeakerTransitionAllowed(existing.status, dto.status)
      ) {
        const allowed = getAllowedBookingRequestSpeakerTransitions(
          existing.status,
        );
        const allowedList =
          allowed.length > 0
            ? allowed.join(', ')
            : '(aucune — statut terminal)';
        throw new BadRequestException(
          `Transition refusée : "${existing.status}" -> "${dto.status}". Transitions possibles depuis "${existing.status}" : ${allowedList}.`,
        );
      }

      // §2 — "marquer comme proposé au client" : proposedToClientAt suffit,
      // pas de table `proposals` séparée (génération PDF explicitement v2,
      // cahier des charges §31).
      const proposedToClientAt =
        dto.status === BookingRequestSpeakerStatus.PROPOSED_TO_CLIENT &&
        existing.proposedToClientAt === null
          ? new Date()
          : undefined;

      const updated = await tx.bookingRequestSpeaker.update({
        where: { id: existing.id },
        data: { status: dto.status, proposedToClientAt },
        select: SELECT,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request_speaker.status_changed',
        entityType: 'BookingRequestSpeaker',
        entityId: existing.id,
        oldValue: { status: existing.status },
        newValue: { status: updated.status },
      });

      return updated;
    });

    return toDto(row);
  }

  async reorder(
    requestId: number,
    dto: ReorderBookingRequestSpeakersDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestSpeakerDto[]> {
    await this.assertBookingRequestExists(requestId);

    const existing = await this.prisma.bookingRequestSpeaker.findMany({
      where: { requestId, deletedAt: null },
      select: { id: true, speakerId: true },
    });
    const existingIds = existing.map((m) => m.speakerId);
    const existingSet = new Set(existingIds);
    const submittedSet = new Set(dto.orderedSpeakerIds);
    const isSamePermutation =
      existingIds.length === dto.orderedSpeakerIds.length &&
      existingIds.every((sid) => submittedSet.has(sid)) &&
      dto.orderedSpeakerIds.every((sid) => existingSet.has(sid));

    if (!isSamePermutation) {
      throw new BadRequestException(
        'orderedSpeakerIds doit être une permutation EXACTE des speakers actuellement dans la sélection (ni ajout, ni retrait, ni doublon).',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [index, speakerId] of dto.orderedSpeakerIds.entries()) {
        const member = existing.find((m) => m.speakerId === speakerId)!;
        await tx.bookingRequestSpeaker.update({
          where: { id: member.id },
          data: { displayOrder: index },
        });
      }
      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request_speaker.reordered',
        entityType: 'BookingRequest',
        entityId: requestId,
        oldValue: null,
        newValue: { orderedSpeakerIds: dto.orderedSpeakerIds },
      });
    });

    return this.findAll(requestId);
  }

  // §7 — retirer un speaker devenu SPEAKER_UNAVAILABLE et le remplacer, en
  // UNE action atomique : l'ancien passe WITHDRAWN, le remplaçant est
  // ajouté/réactivé, dans la même transaction.
  async replace(
    requestId: number,
    speakerId: number,
    dto: ReplaceBookingRequestSpeakerDto,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestSpeakerDto> {
    if (dto.replacementSpeakerId === speakerId) {
      throw new BadRequestException(
        'replacementSpeakerId doit être différent du speaker retiré.',
      );
    }
    await this.assertSpeakerExists(dto.replacementSpeakerId);

    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookingRequestSpeaker.findFirst({
        where: { requestId, speakerId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(
          `Speaker ${speakerId} introuvable dans la sélection de la demande ${requestId}.`,
        );
      }
      if (existing.status !== BookingRequestSpeakerStatus.SPEAKER_UNAVAILABLE) {
        throw new BadRequestException(
          `Le remplacement (§7) n'est proposé que pour un speaker "SPEAKER_UNAVAILABLE" (statut actuel : "${existing.status}").`,
        );
      }

      await tx.bookingRequestSpeaker.update({
        where: { id: existing.id },
        data: { status: BookingRequestSpeakerStatus.WITHDRAWN },
      });
      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request_speaker.status_changed',
        entityType: 'BookingRequestSpeaker',
        entityId: existing.id,
        oldValue: { status: existing.status },
        newValue: {
          status: BookingRequestSpeakerStatus.WITHDRAWN,
          reason: 'replaced',
          replacementSpeakerId: dto.replacementSpeakerId,
        },
      });

      return this.addOrReactivate(
        tx,
        requestId,
        dto.replacementSpeakerId,
        undefined,
        actor,
      );
    });

    return toDto(row);
  }

  private async addOrReactivate(
    tx: Prisma.TransactionClient,
    requestId: number,
    speakerId: number,
    internalNotes: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<Row> {
    const existing = await tx.bookingRequestSpeaker.findUnique({
      where: { requestId_speakerId: { requestId, speakerId } },
    });

    if (existing && existing.deletedAt === null) {
      throw new ConflictException(
        `Speaker ${speakerId} déjà dans la sélection de la demande ${requestId} (statut "${existing.status}").`,
      );
    }

    if (existing) {
      // Ligne soft-supprimée (ou WITHDRAWN) : réactivée plutôt que
      // dupliquée — voir le commentaire sur `add()`.
      const updated = await tx.bookingRequestSpeaker.update({
        where: { id: existing.id },
        data: {
          status: BookingRequestSpeakerStatus.SHORTLISTED,
          displayOrder: existing.displayOrder,
          internalNotes: sanitizeOptionalText(internalNotes) ?? null,
          proposedToClientAt: null,
          addedById: actor.id,
          addedAt: new Date(),
          deletedAt: null,
        },
        select: SELECT,
      });
      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request_speaker.added',
        entityType: 'BookingRequestSpeaker',
        entityId: updated.id,
        oldValue: null,
        newValue: { speakerId, reactivated: true },
      });
      return updated;
    }

    const created = await tx.bookingRequestSpeaker.create({
      data: {
        requestId,
        speakerId,
        addedById: actor.id,
        internalNotes: sanitizeOptionalText(internalNotes) ?? null,
      },
      select: SELECT,
    });
    await this.activityLog.record(tx, {
      actorId: actor.id,
      action: 'booking_request_speaker.added',
      entityType: 'BookingRequestSpeaker',
      entityId: created.id,
      oldValue: null,
      newValue: { speakerId, reactivated: false },
    });
    return created;
  }

  private async assertBookingRequestExists(requestId: number): Promise<void> {
    const request = await this.prisma.bookingRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    });
    if (!request) {
      throw new NotFoundException(`Demande ${requestId} introuvable.`);
    }
  }

  private async assertSpeakerExists(speakerId: number): Promise<void> {
    const speaker = await this.prisma.speaker.findFirst({
      where: { id: speakerId, deletedAt: null },
      select: { id: true },
    });
    if (!speaker) {
      throw new NotFoundException(`Speaker ${speakerId} introuvable.`);
    }
  }
}

function toDto(row: Row): BookingRequestSpeakerDto {
  return {
    id: row.id,
    speaker: {
      id: row.speaker.id,
      displayName:
        row.speaker.publicName ??
        `${row.speaker.firstName} ${row.speaker.lastName}`,
      slug: row.speaker.slug,
      profilePhotoUrl: row.speaker.profilePhotoUrl,
    },
    status: row.status,
    displayOrder: row.displayOrder,
    internalNotes: row.internalNotes,
    proposedToClientAt: row.proposedToClientAt?.toISOString() ?? null,
    addedAt: row.addedAt.toISOString(),
    addedByEmail: row.addedBy?.email ?? null,
  };
}
