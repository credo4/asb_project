import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RosterApplicationAttachment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StorageService } from '../../storage/storage.service';
import {
  ATTACHMENT_ALLOWED_MIME_TYPES,
  FileValidationService,
} from '../media/file-validation.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import {
  createSignedResourceToken,
  decodeSignedResourceToken,
  isResourceSignatureValid,
} from '../../common/utils/signed-link.util';
import { toAttachmentDto } from './mappers/roster-application.mapper';
import { RosterApplicationAttachmentDto } from './dto/outputs/attachment.dto';
import { DownloadLinkDto } from './dto/outputs/download-link.dto';
import {
  ATTACHMENT_EXTENSION_BY_MIME,
  ATTACHMENT_MAX_SIZE_BYTES,
  ATTACHMENT_SUBDIR,
} from './roster-application-attachments.constants';

const ATTACHMENT_ADMIN_INCLUDE = {
  uploadedBy: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} as const;

// RÉUTILISE intégralement la brique de stockage privé de la Phase 2c (§5) —
// même service, mêmes principes que BookingRequestAttachmentsService (Phase
// 3b), rien réimplémenté. Accès strictement ADMIN/SUPER_ADMIN — jamais de
// route publique, jamais de rôle SPEAKER (même après conversion).
@Injectable()
export class RosterApplicationAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly storage: StorageService,
    private readonly fileValidation: FileValidationService,
    private readonly config: ConfigService,
  ) {}

  async listForApplication(
    applicationId: number,
  ): Promise<RosterApplicationAttachmentDto[]> {
    const exists = await this.prisma.rosterApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Candidature ${applicationId} introuvable.`);
    }

    const rows = await this.prisma.rosterApplicationAttachment.findMany({
      where: { applicationId, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
      include: ATTACHMENT_ADMIN_INCLUDE,
    });
    return rows.map(toAttachmentDto);
  }

  async upload(
    applicationId: number,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedUser,
  ): Promise<RosterApplicationAttachmentDto> {
    const application = await this.prisma.rosterApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!application) {
      throw new NotFoundException(`Candidature ${applicationId} introuvable.`);
    }

    if (!file) {
      throw new BadRequestException('Fichier requis (champ "file").');
    }
    if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
      throw new BadRequestException('Fichier trop volumineux (20 Mo maximum).');
    }

    const mimeType = await this.fileValidation.detectAllowedType(
      file.buffer,
      ATTACHMENT_ALLOWED_MIME_TYPES,
    );
    const ext = ATTACHMENT_EXTENSION_BY_MIME[mimeType] ?? 'bin';

    const storageKey = await this.storage.savePrivate(
      file.buffer,
      ATTACHMENT_SUBDIR,
      `${randomUUID()}.${ext}`,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.rosterApplicationAttachment.create({
        data: {
          applicationId,
          storageKey,
          originalFilename: file.originalname,
          mimeType,
          sizeBytes: file.size,
          uploadedById: actor.id,
        },
        include: ATTACHMENT_ADMIN_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'roster_application.attachment_uploaded',
        entityType: 'RosterApplication',
        entityId: applicationId,
        oldValue: null,
        newValue: {
          attachmentId: row.id,
          originalFilename: row.originalFilename,
        },
      });

      return row;
    });

    return toAttachmentDto(created);
  }

  async remove(
    applicationId: number,
    attachmentId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.rosterApplicationAttachment.findFirst({
        where: { id: attachmentId, applicationId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(
          `Pièce jointe ${attachmentId} introuvable.`,
        );
      }

      const deletedAt = new Date();
      await tx.rosterApplicationAttachment.update({
        where: { id: attachmentId },
        data: { deletedAt },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'roster_application.attachment_deleted',
        entityType: 'RosterApplication',
        entityId: applicationId,
        oldValue: { attachmentId, deletedAt: null },
        newValue: { attachmentId, deletedAt: deletedAt.toISOString() },
      });
    });
  }

  async createDownloadLink(
    applicationId: number,
    attachmentId: number,
    actor: AuthenticatedUser,
  ): Promise<DownloadLinkDto> {
    const attachment = await this.prisma.rosterApplicationAttachment.findFirst({
      where: { id: attachmentId, applicationId, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException(`Pièce jointe ${attachmentId} introuvable.`);
    }

    const ttlSeconds = this.config.get<number>(
      'FILE_SIGNING_TTL_DOCUMENTS',
      60,
    );
    const secret = this.config.getOrThrow<string>('FILE_SIGNING_SECRET');
    const appUrl = this.config.get<string>('APP_URL', '');
    const expiresAt = Date.now() + ttlSeconds * 1000;

    const token = createSignedResourceToken(
      secret,
      { resourceId: attachment.id, issuedForUserId: actor.id, expiresAt },
      attachment.storageKey,
    );

    await this.activityLog.record(this.prisma, {
      actorId: actor.id,
      action: 'roster_application.attachment_download_link_issued',
      entityType: 'RosterApplication',
      entityId: applicationId,
      oldValue: null,
      newValue: { attachmentId, expiresAt: new Date(expiresAt).toISOString() },
    });

    return {
      url: `${appUrl}/files/roster-attachments/download?token=${encodeURIComponent(token)}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  // Même principe que BookingRequestAttachmentsService#resolveDownload : la
  // signature est vérifiée en premier (sans état), la survie de la ressource
  // en DERNIER — une pièce jointe supprimée APRÈS l'émission du lien redevient
  // introuvable (404), jamais "expirée" (410).
  async resolveDownload(
    token: string,
  ): Promise<{ attachment: RosterApplicationAttachment; stream: Readable }> {
    const decoded = decodeSignedResourceToken(token);
    if (!decoded.ok) {
      throw new UnauthorizedException('Lien de téléchargement invalide.');
    }

    const attachment = await this.prisma.rosterApplicationAttachment.findUnique(
      { where: { id: decoded.payload.resourceId } },
    );
    if (!attachment) {
      throw new NotFoundException('Pièce jointe introuvable.');
    }

    const secret = this.config.getOrThrow<string>('FILE_SIGNING_SECRET');
    const valid = isResourceSignatureValid(
      secret,
      decoded.payloadB64,
      attachment.storageKey,
      decoded.signature,
    );
    if (!valid) {
      throw new UnauthorizedException('Lien de téléchargement invalide.');
    }

    if (Date.now() > decoded.payload.expiresAt) {
      throw new GoneException('Ce lien de téléchargement a expiré.');
    }

    if (attachment.deletedAt !== null) {
      throw new NotFoundException('Pièce jointe introuvable.');
    }

    const stream = await this.storage.streamPrivate(attachment.storageKey);
    return { attachment, stream };
  }
}
