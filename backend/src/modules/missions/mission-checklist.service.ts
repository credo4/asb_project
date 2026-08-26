import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { sanitizeOptionalText } from '../../common/utils/sanitize-text.util';
import { slugify } from '../speakers/slug.util';
import { ToggleChecklistItemDto } from './dto/toggle-checklist-item.dto';
import { AddChecklistItemDto } from './dto/add-checklist-item.dto';
import { MissionChecklistItemDto } from './dto/outputs/mission-checklist-item.dto';
import { toChecklistDto } from './mappers/mission-checklist.mapper';

// §4 — chaque coche est journalisée avec son auteur. Endpoints ADMIN
// uniquement (le prompt ne demande aucun accès speaker à la checklist).
@Injectable()
export class MissionChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async toggle(
    missionId: number,
    itemId: number,
    dto: ToggleChecklistItemDto,
    actor: AuthenticatedUser,
  ): Promise<MissionChecklistItemDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.missionChecklistItem.findFirst({
        where: { id: itemId, missionId },
      });
      if (!existing) {
        throw new NotFoundException(
          `Point de checklist ${itemId} introuvable.`,
        );
      }

      const updated = await tx.missionChecklistItem.update({
        where: { id: itemId },
        data: {
          isDone: dto.isDone,
          doneAt: dto.isDone ? new Date() : null,
          doneById: dto.isDone ? actor.id : null,
          notes:
            dto.notes !== undefined
              ? sanitizeOptionalText(dto.notes)
              : undefined,
        },
        include: { doneBy: { select: { email: true } } },
      });

      // entityType='Mission' (pas 'MissionChecklistItem') : même pattern
      // que booking_request_notes/attachments en 3b — TOUTES les actions
      // relatives à une mission journalisent sous le même couple
      // (entityType, entityId) pour que GET .../history reste un flux
      // unique, pas une agrégation de plusieurs sources. L'id du point de
      // checklist reste disponible dans newValue.
      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: dto.isDone
          ? 'mission_checklist_item.checked'
          : 'mission_checklist_item.unchecked',
        entityType: 'Mission',
        entityId: missionId,
        oldValue: { checklistItemId: itemId, isDone: existing.isDone },
        newValue: { checklistItemId: itemId, isDone: updated.isDone },
      });

      return updated;
    });

    return toChecklistDto(row);
  }

  async add(
    missionId: number,
    dto: AddChecklistItemDto,
    actor: AuthenticatedUser,
  ): Promise<MissionChecklistItemDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const mission = await tx.mission.findFirst({
        where: { id: missionId, deletedAt: null },
        select: { id: true },
      });
      if (!mission) {
        throw new NotFoundException(`Mission ${missionId} introuvable.`);
      }

      const maxOrder = await tx.missionChecklistItem.aggregate({
        where: { missionId },
        _max: { displayOrder: true },
      });

      const created = await tx.missionChecklistItem.create({
        data: {
          missionId,
          // Préfixé "custom-" : un code de point ajouté par l'admin ne doit
          // jamais entrer en collision avec un code du modèle standard
          // (mission-checklist.constants.ts), même si le label choisi
          // ressemble à un point existant.
          code: `custom-${slugify(dto.label)}`,
          label: dto.label,
          displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
        },
        include: { doneBy: { select: { email: true } } },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'mission_checklist_item.added',
        entityType: 'Mission',
        entityId: missionId,
        oldValue: null,
        newValue: { checklistItemId: created.id, label: created.label },
      });

      return created;
    });

    return toChecklistDto(row);
  }
}
