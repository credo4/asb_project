import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { sanitizeText } from '../../common/utils/sanitize-text.util';
import { resolveOwnSpeakerId } from '../speakers/resolve-own-speaker.util';
import { CreateMissionMessageDto } from './dto/create-mission-message.dto';
import { MissionMessageDto } from './dto/outputs/mission-message.dto';
import { toMessageDto } from './mappers/mission-message.mapper';

const MESSAGE_INCLUDE = { author: { select: { email: true } } } as const;

// §6 — fil en AJOUT SEUL, visible de l'admin et du SEUL speaker concerné.
@Injectable()
export class MissionMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async listForAdmin(missionId: number): Promise<MissionMessageDto[]> {
    await this.assertMissionExists(missionId);
    const rows = await this.prisma.missionMessage.findMany({
      where: { missionId },
      orderBy: { createdAt: 'asc' },
      include: MESSAGE_INCLUDE,
    });
    return rows.map(toMessageDto);
  }

  async createForAdmin(
    missionId: number,
    dto: CreateMissionMessageDto,
    actor: AuthenticatedUser,
  ): Promise<MissionMessageDto> {
    await this.assertMissionExists(missionId);
    return this.create(missionId, dto, actor, actor.role);
  }

  async listForSpeaker(
    actor: AuthenticatedUser,
    missionId: number,
  ): Promise<MissionMessageDto[]> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    await this.assertOwnMission(missionId, speakerId);
    const rows = await this.prisma.missionMessage.findMany({
      where: { missionId },
      orderBy: { createdAt: 'asc' },
      include: MESSAGE_INCLUDE,
    });
    return rows.map(toMessageDto);
  }

  async createForSpeaker(
    actor: AuthenticatedUser,
    missionId: number,
    dto: CreateMissionMessageDto,
  ): Promise<MissionMessageDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    await this.assertOwnMission(missionId, speakerId);
    return this.create(missionId, dto, actor, Role.SPEAKER);
  }

  private async create(
    missionId: number,
    dto: CreateMissionMessageDto,
    actor: AuthenticatedUser,
    authorRole: Role,
  ): Promise<MissionMessageDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.missionMessage.create({
        data: {
          missionId,
          authorId: actor.id,
          authorRole,
          body: sanitizeText(dto.body),
        },
        include: MESSAGE_INCLUDE,
      });

      // entityType='Mission' — même pattern que le reste du module (voir
      // mission-checklist.service.ts pour le raisonnement complet).
      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'mission_message.created',
        entityType: 'Mission',
        entityId: missionId,
        oldValue: null,
        newValue: { messageId: created.id, authorRole },
      });

      return created;
    });

    return toMessageDto(row);
  }

  private async assertMissionExists(missionId: number): Promise<void> {
    const mission = await this.prisma.mission.findFirst({
      where: { id: missionId, deletedAt: null },
      select: { id: true },
    });
    if (!mission) {
      throw new NotFoundException(`Mission ${missionId} introuvable.`);
    }
  }

  private async assertOwnMission(
    missionId: number,
    speakerId: number,
  ): Promise<void> {
    const mission = await this.prisma.mission.findFirst({
      where: { id: missionId, speakerId, deletedAt: null },
      select: { id: true },
    });
    if (!mission) {
      throw new NotFoundException(`Mission ${missionId} introuvable.`);
    }
  }
}
