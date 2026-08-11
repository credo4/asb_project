import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaReviewStatus, MediaType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StorageService } from '../../storage/storage.service';
import { ImageProcessingService } from '../media/image-processing.service';
import { FileValidationService } from '../media/file-validation.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { resolveOwnSpeakerId } from '../speakers/resolve-own-speaker.util';
import {
  sanitizeOptionalText,
  sanitizeText,
} from '../../common/utils/sanitize-text.util';
import {
  MEDIA_ADMIN_INCLUDE,
  MEDIA_INCLUDE,
  MediaRow,
} from './speaker-media.includes';
import {
  scalarSnapshot,
  toAdminDto,
  toOwnDto,
} from './mappers/speaker-media.mapper';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { ReorderMediaDto } from './dto/reorder-media.dto';
import { ReviewMediaDto } from './dto/review-media.dto';
import { QuerySpeakerMediaDto } from './dto/query-speaker-media.dto';
import { SpeakerMediaItemDto } from './dto/outputs/speaker-media-item.dto';
import { AdminMediaListResponseDto } from './dto/outputs/admin-media-item.dto';
import { assertAllowedVideoEmbedUrl } from './video-embed.util';
import {
  MEDIA_QUOTA_PER_SPEAKER,
  MEDIA_SUBDIR,
  PHOTO_MAX_SIZE_BYTES,
} from './speaker-media.constants';

@Injectable()
export class SpeakerMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly storage: StorageService,
    private readonly imageProcessing: ImageProcessingService,
    private readonly fileValidation: FileValidationService,
  ) {}

  // ---------------------------------------------------------------------
  // Self-service SPEAKER
  // ---------------------------------------------------------------------

  async listOwn(actor: AuthenticatedUser): Promise<SpeakerMediaItemDto[]> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    const rows = await this.prisma.speakerMedia.findMany({
      where: { speakerId, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
      include: MEDIA_INCLUDE,
    });
    return rows.map(toOwnDto);
  }

  async uploadOwn(
    actor: AuthenticatedUser,
    dto: CreateMediaDto,
    file: Express.Multer.File | undefined,
  ): Promise<SpeakerMediaItemDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);

    const activeCount = await this.prisma.speakerMedia.count({
      where: { speakerId, deletedAt: null },
    });
    if (activeCount >= MEDIA_QUOTA_PER_SPEAKER) {
      throw new BadRequestException(
        `Quota atteint : ${MEDIA_QUOTA_PER_SPEAKER} médias maximum par profil.`,
      );
    }

    const { url, thumbnailUrl } = await this.storeUploadedContent(dto, file);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.speakerMedia.create({
        data: {
          speakerId,
          type: dto.type,
          url,
          thumbnailUrl,
          title: dto.title ? sanitizeText(dto.title) : undefined,
          caption: sanitizeOptionalText(dto.caption),
          displayOrder: activeCount,
          // status reste PENDING_REVIEW (défaut du schéma) : ce chemin est
          // le libre-service speaker, contrairement au CRUD admin qui écrit
          // directement en APPROVED (voir SpeakersService).
        },
        include: MEDIA_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_media.uploaded',
        entityType: 'SpeakerMedia',
        entityId: row.id,
        oldValue: null,
        newValue: scalarSnapshot(row),
      });

      return row;
    });

    return toOwnDto(created);
  }

  async updateOwn(
    actor: AuthenticatedUser,
    id: number,
    dto: UpdateMediaDto,
  ): Promise<SpeakerMediaItemDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);

    const updated = await this.prisma.$transaction(async (tx) => {
      // TOUJOURS where: { id, speakerId, deletedAt: null } — jamais un
      // findUnique({ id }) suivi d'un contrôle après coup (voir §2 : un id
      // d'un autre speaker doit produire 404, pas 403).
      const existing = await tx.speakerMedia.findFirst({
        where: { id, speakerId, deletedAt: null },
        include: MEDIA_INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException(`Média ${id} introuvable.`);
      }

      const row = await tx.speakerMedia.update({
        where: { id },
        data: {
          title: dto.title !== undefined ? sanitizeText(dto.title) : undefined,
          caption:
            dto.caption !== undefined
              ? sanitizeOptionalText(dto.caption)
              : undefined,
          // Contenu public modifié : redemande une revue, quel que soit le
          // statut précédent (y compris un REJECTED corrigé, ou un APPROVED
          // dont le texte change sans que l'admin l'ait revu).
          status: MediaReviewStatus.PENDING_REVIEW,
          reviewedAt: null,
          reviewedById: null,
          rejectionReason: null,
        },
        include: MEDIA_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_media.updated',
        entityType: 'SpeakerMedia',
        entityId: id,
        oldValue: scalarSnapshot(existing),
        newValue: scalarSnapshot(row),
      });

      return row;
    });

    return toOwnDto(updated);
  }

  async removeOwn(actor: AuthenticatedUser, id: number): Promise<void> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.speakerMedia.findFirst({
        where: { id, speakerId, deletedAt: null },
        include: MEDIA_INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException(`Média ${id} introuvable.`);
      }

      // Soft delete uniquement : le fichier physique n'est PAS supprimé à
      // cette étape (un job de nettoyage des fichiers orphelins viendra plus
      // tard). Disparaît immédiatement de l'API publique (filtrée sur
      // deletedAt: null).
      const deletedAt = new Date();
      await tx.speakerMedia.update({ where: { id }, data: { deletedAt } });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_media.deleted',
        entityType: 'SpeakerMedia',
        entityId: id,
        oldValue: { deletedAt: null },
        newValue: { deletedAt: deletedAt.toISOString() },
      });
    });
  }

  async reorderOwn(
    actor: AuthenticatedUser,
    dto: ReorderMediaDto,
  ): Promise<SpeakerMediaItemDto[]> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);

    const existingIds = (
      await this.prisma.speakerMedia.findMany({
        where: { speakerId, deletedAt: null },
        select: { id: true },
      })
    ).map((r) => r.id);

    const existingSet = new Set(existingIds);
    const submittedSet = new Set(dto.orderedIds);
    const isSamePermutation =
      existingIds.length === dto.orderedIds.length &&
      existingIds.every((id) => submittedSet.has(id)) &&
      dto.orderedIds.every((id) => existingSet.has(id));

    if (!isSamePermutation) {
      throw new BadRequestException(
        "orderedIds doit contenir exactement l'ensemble des médias actifs de ce profil, sans doublon ni omission.",
      );
    }

    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.speakerMedia.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    return this.listOwn(actor);
  }

  // ---------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------

  async findAllForAdmin(
    query: QuerySpeakerMediaDto,
  ): Promise<AdminMediaListResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const where: Prisma.SpeakerMediaWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.speakerMedia.count({ where }),
      this.prisma.speakerMedia.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
        include: MEDIA_ADMIN_INCLUDE,
      }),
    ]);

    return {
      data: rows.map(toAdminDto),
      meta: { total, page, perPage },
    };
  }

  async reviewAsAdmin(
    id: number,
    dto: ReviewMediaDto,
    actor: AuthenticatedUser,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.speakerMedia.findFirst({
        where: { id, deletedAt: null },
        include: MEDIA_ADMIN_INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException(`Média ${id} introuvable.`);
      }

      const row = await tx.speakerMedia.update({
        where: { id },
        data: {
          status: dto.status,
          reviewedAt: new Date(),
          reviewedById: actor.id,
          rejectionReason:
            dto.status === MediaReviewStatus.REJECTED
              ? dto.rejectionReason
              : null,
        },
        include: MEDIA_ADMIN_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action:
          dto.status === MediaReviewStatus.APPROVED
            ? 'speaker_media.approved'
            : 'speaker_media.rejected',
        entityType: 'SpeakerMedia',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: row.status },
      });

      return row;
    });

    return toAdminDto(updated);
  }

  // ---------------------------------------------------------------------
  // Stockage du contenu uploadé
  // ---------------------------------------------------------------------

  private async storeUploadedContent(
    dto: CreateMediaDto,
    file: Express.Multer.File | undefined,
  ): Promise<{ url: string; thumbnailUrl: string | null }> {
    if (dto.type === MediaType.VIDEO) {
      if (file) {
        throw new BadRequestException(
          'Aucun fichier ne doit être joint pour un média de type VIDEO — fournissez "url" (lien d\'embed).',
        );
      }
      if (!dto.url) {
        throw new BadRequestException(
          '"url" est requis pour un média de type VIDEO.',
        );
      }
      assertAllowedVideoEmbedUrl(dto.url);
      return { url: dto.url, thumbnailUrl: null };
    }

    if (!file) {
      throw new BadRequestException(
        'Fichier requis (champ "file") pour ce type de média.',
      );
    }

    // Nom généré côté serveur (jamais celui du client) : protège contre le
    // path traversal et les collisions de noms.
    const id = randomUUID();

    if (dto.type === MediaType.PHOTO) {
      // Multer autorise jusqu'à PRESS_KIT_MAX_SIZE_BYTES (voir controller) :
      // la limite plus stricte propre aux photos est revérifiée ici.
      if (file.size > PHOTO_MAX_SIZE_BYTES) {
        throw new BadRequestException(
          'Photo trop volumineuse (10 Mo maximum).',
        );
      }
      // ImageProcessingService valide déjà le contenu réel (sharp doit
      // pouvoir décoder le buffer) — même garde-fou "par le contenu, pas par
      // l'extension" que pour les PDF, voir FileValidationService.
      const processed = await this.imageProcessing.process(file.buffer);
      const displayKey = await this.storage.savePublic(
        processed.display.buffer,
        MEDIA_SUBDIR,
        `${id}.webp`,
      );
      const thumbKey = await this.storage.savePublic(
        processed.thumbnail.buffer,
        MEDIA_SUBDIR,
        `${id}-thumb.webp`,
      );
      return {
        url: this.storage.getPublicUrl(displayKey),
        thumbnailUrl: this.storage.getPublicUrl(thumbKey),
      };
    }

    // PRESS_KIT
    await this.fileValidation.assertIsPdf(file.buffer);
    const key = await this.storage.savePublic(
      file.buffer,
      MEDIA_SUBDIR,
      `${id}.pdf`,
    );
    return { url: this.storage.getPublicUrl(key), thumbnailUrl: null };
  }
}

// Réexport pour les modules qui n'ont besoin que du type de ligne.
export type { MediaRow };
