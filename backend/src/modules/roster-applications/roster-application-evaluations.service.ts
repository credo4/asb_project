import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { toEvaluationDto } from './mappers/roster-application.mapper';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { RosterApplicationEvaluationDto } from './dto/outputs/evaluation.dto';

const EVALUATOR_INCLUDE = {
  evaluator: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} as const;

// §2 — UNE évaluation PAR évaluateur. "own*" (voir le pattern déjà utilisé
// par SpeakerRevisionsService pour le self-service speaker) : l'évaluateur
// est TOUJOURS dérivé de `actor.id`, jamais d'un id fourni par l'appelant —
// impossible de créer/modifier l'évaluation d'un autre admin par erreur ou
// malveillance. Plusieurs admins évaluent indépendamment : c'est voulu (des
// avis distincts), la contrainte unique (applicationId, evaluatorId) garantit
// juste qu'un même admin ne peut pas avoir deux lignes concurrentes.
@Injectable()
export class RosterApplicationEvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async listForApplication(
    applicationId: number,
  ): Promise<RosterApplicationEvaluationDto[]> {
    const exists = await this.prisma.rosterApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Candidature ${applicationId} introuvable.`);
    }

    const rows = await this.prisma.rosterApplicationEvaluation.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
      include: EVALUATOR_INCLUDE,
    });
    return rows.map(toEvaluationDto);
  }

  // upsert — pas de create/update séparés côté HTTP : PUT est intrinsèquement
  // idempotent, et la contrainte unique (applicationId, evaluatorId) est
  // EXACTEMENT ce qu'exprime `upsert` côté Prisma (pas de fenêtre de course
  // "findFirst puis create/update" à gérer nous-mêmes).
  async upsertOwn(
    applicationId: number,
    dto: CreateEvaluationDto,
    actor: AuthenticatedUser,
  ): Promise<RosterApplicationEvaluationDto> {
    const application = await this.prisma.rosterApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!application) {
      throw new NotFoundException(`Candidature ${applicationId} introuvable.`);
    }

    const data = {
      expertiseLevel: dto.expertiseLevel,
      professionalCredibility: dto.professionalCredibility,
      stageExperience: dto.stageExperience,
      speakingQuality: dto.speakingQuality,
      internationalRelevance: dto.internationalRelevance,
      languageProficiency: dto.languageProficiency,
      mediaQuality: dto.mediaQuality,
      pillarFit: dto.pillarFit,
      commercialPotential: dto.commercialPotential,
      comment: dto.comment,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.rosterApplicationEvaluation.findUnique({
        where: {
          applicationId_evaluatorId: {
            applicationId,
            evaluatorId: actor.id,
          },
        },
      });

      const row = await tx.rosterApplicationEvaluation.upsert({
        where: {
          applicationId_evaluatorId: {
            applicationId,
            evaluatorId: actor.id,
          },
        },
        create: { applicationId, evaluatorId: actor.id, ...data },
        update: data,
        include: EVALUATOR_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: existing
          ? 'roster_application.evaluation_updated'
          : 'roster_application.evaluation_created',
        entityType: 'RosterApplication',
        entityId: applicationId,
        oldValue: existing,
        newValue: data,
      });

      return row;
    });

    return toEvaluationDto(result);
  }
}
