import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MissionDocument, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StorageService } from '../../storage/storage.service';
import {
  ATTACHMENT_ALLOWED_MIME_TYPES,
  FileValidationService,
} from '../media/file-validation.service';
import { MailService } from '../../mail/mail.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { resolveOwnSpeakerId } from '../speakers/resolve-own-speaker.util';
import {
  createSignedResourceToken,
  decodeSignedResourceToken,
  isResourceSignatureValid,
} from '../../common/utils/signed-link.util';
import {
  MISSION_DOCUMENT_EXTENSION_BY_MIME,
  MISSION_DOCUMENT_MAX_SIZE_BYTES,
  MISSION_DOCUMENT_SUBDIR,
} from './mission-documents.constants';
import { CreateMissionDocumentDto } from './dto/create-mission-document.dto';
import { MissionDocumentDto } from './dto/outputs/mission-document.dto';
import { DownloadLinkDto } from './dto/outputs/download-link.dto';
import { toDocumentDto } from './mappers/mission-document.mapper';

const DOCUMENT_INCLUDE = { uploadedBy: { select: { email: true } } } as const;

// §7 — RÉUTILISE intégralement la brique de stockage privé de la Phase 2c
// (StorageService.savePrivate, validation par magic bytes, liens signés
// HMAC, revalidation en base avant streaming) — même pattern que
// booking_request_attachments (Phase 3b). Ne réimplémente rien.
@Injectable()
export class MissionDocumentsService {
  private readonly logger = new Logger(MissionDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly storage: StorageService,
    private readonly fileValidation: FileValidationService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly appSettings: AppSettingsService,
  ) {}

  // ---------------------------------------------------------------------
  // ADMIN — voit TOUT (§7).
  // ---------------------------------------------------------------------

  async listForAdmin(missionId: number): Promise<MissionDocumentDto[]> {
    await this.assertMissionExists(missionId);
    const rows = await this.prisma.missionDocument.findMany({
      where: { missionId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: DOCUMENT_INCLUDE,
    });
    return rows.map(toDocumentDto);
  }

  async uploadForAdmin(
    missionId: number,
    dto: CreateMissionDocumentDto,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedUser,
  ): Promise<MissionDocumentDto> {
    return this.upload(
      missionId,
      dto,
      dto.isSharedWithSpeaker ?? false,
      file,
      actor,
      actor.role,
    );
  }

  async createAdminDownloadLink(
    missionId: number,
    documentId: number,
    actor: AuthenticatedUser,
  ): Promise<DownloadLinkDto> {
    const document = await this.prisma.missionDocument.findFirst({
      where: { id: documentId, missionId, deletedAt: null },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} introuvable.`);
    }
    return this.mintLink(document, actor);
  }

  async remove(
    missionId: number,
    documentId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.missionDocument.findFirst({
        where: { id: documentId, missionId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Document ${documentId} introuvable.`);
      }

      const deletedAt = new Date();
      await tx.missionDocument.update({
        where: { id: documentId },
        data: { deletedAt },
      });

      // entityType='Mission' (même pattern que ailleurs dans ce module —
      // voir le commentaire équivalent dans mission-checklist.service.ts).
      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'mission_document.deleted',
        entityType: 'Mission',
        entityId: missionId,
        oldValue: { documentId, deletedAt: null },
        newValue: { documentId, deletedAt: deletedAt.toISOString() },
      });
    });
  }

  // ---------------------------------------------------------------------
  // SPEAKER (§7) — voit uniquement isSharedWithSpeaker = true ET ce qu'il a
  // lui-même déposé. Scoping EXCLUSIVEMENT via resolveOwnSpeakerId.
  // ---------------------------------------------------------------------

  async listForSpeaker(actor: AuthenticatedUser, missionId: number) {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    await this.assertOwnMission(missionId, speakerId);

    const rows = await this.prisma.missionDocument.findMany({
      where: {
        missionId,
        deletedAt: null,
        OR: [{ isSharedWithSpeaker: true }, { uploadedById: actor.id }],
      },
      orderBy: { createdAt: 'desc' },
      include: DOCUMENT_INCLUDE,
    });
    return rows.map(toDocumentDto);
  }

  async uploadForSpeaker(
    actor: AuthenticatedUser,
    missionId: number,
    dto: CreateMissionDocumentDto,
    file: Express.Multer.File | undefined,
  ): Promise<MissionDocumentDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    await this.assertOwnMission(missionId, speakerId);

    // §7 — un speaker ne peut jamais se partager un document à lui-même
    // (le champ n'a de sens que côté admin) : toujours forcé à false ici,
    // quoi que le corps de la requête contienne.
    const created = await this.upload(
      missionId,
      dto,
      false,
      file,
      actor,
      Role.SPEAKER,
    );

    await this.notifyAdminDocumentDeposited(missionId, created);
    return created;
  }

  async createOwnDownloadLink(
    actor: AuthenticatedUser,
    missionId: number,
    documentId: number,
  ): Promise<DownloadLinkDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    await this.assertOwnMission(missionId, speakerId);

    const document = await this.prisma.missionDocument.findFirst({
      where: {
        id: documentId,
        missionId,
        deletedAt: null,
        OR: [{ isSharedWithSpeaker: true }, { uploadedById: actor.id }],
      },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} introuvable.`);
    }
    return this.mintLink(document, actor);
  }

  // ---------------------------------------------------------------------
  // Streaming — même principe que SpeakerDocumentsService#resolveDownload :
  // signature vérifiée en premier (sans état), survie de la ressource en
  // DERNIER — un document supprimé APRÈS l'émission du lien redevient
  // introuvable (404), jamais "expiré" (410).
  // ---------------------------------------------------------------------

  async resolveDownload(
    token: string,
  ): Promise<{ document: MissionDocument; stream: Readable }> {
    const decoded = decodeSignedResourceToken(token);
    if (!decoded.ok) {
      throw new UnauthorizedException('Lien de téléchargement invalide.');
    }

    const document = await this.prisma.missionDocument.findUnique({
      where: { id: decoded.payload.resourceId },
    });
    if (!document) {
      throw new NotFoundException('Document introuvable.');
    }

    const secret = this.config.getOrThrow<string>('FILE_SIGNING_SECRET');
    const valid = isResourceSignatureValid(
      secret,
      decoded.payloadB64,
      document.storageKey,
      decoded.signature,
    );
    if (!valid) {
      throw new UnauthorizedException('Lien de téléchargement invalide.');
    }

    if (Date.now() > decoded.payload.expiresAt) {
      throw new GoneException('Ce lien de téléchargement a expiré.');
    }

    if (document.deletedAt !== null) {
      throw new NotFoundException('Document introuvable.');
    }

    const stream = await this.storage.streamPrivate(document.storageKey);
    return { document, stream };
  }

  // ---------------------------------------------------------------------
  // Privé
  // ---------------------------------------------------------------------

  private async upload(
    missionId: number,
    dto: CreateMissionDocumentDto,
    isSharedWithSpeaker: boolean,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedUser,
    uploadedByRole: Role,
  ): Promise<MissionDocumentDto> {
    await this.assertMissionExists(missionId);

    if (!file) {
      throw new BadRequestException('Fichier requis (champ "file").');
    }
    if (file.size > MISSION_DOCUMENT_MAX_SIZE_BYTES) {
      throw new BadRequestException('Fichier trop volumineux (20 Mo maximum).');
    }

    const mimeType = await this.fileValidation.detectAllowedType(
      file.buffer,
      ATTACHMENT_ALLOWED_MIME_TYPES,
    );
    const ext = MISSION_DOCUMENT_EXTENSION_BY_MIME[mimeType] ?? 'bin';

    const storageKey = await this.storage.savePrivate(
      file.buffer,
      MISSION_DOCUMENT_SUBDIR,
      `${randomUUID()}.${ext}`,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.missionDocument.create({
        data: {
          missionId,
          type: dto.type,
          isSharedWithSpeaker,
          storageKey,
          originalFilename: file.originalname,
          mimeType,
          sizeBytes: file.size,
          uploadedById: actor.id,
          uploadedByRole,
        },
        include: DOCUMENT_INCLUDE,
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'mission_document.uploaded',
        entityType: 'Mission',
        entityId: missionId,
        oldValue: null,
        newValue: {
          documentId: row.id,
          type: row.type,
          originalFilename: row.originalFilename,
        },
      });

      return row;
    });

    return toDocumentDto(created);
  }

  private async mintLink(
    document: MissionDocument,
    actor: AuthenticatedUser,
  ): Promise<DownloadLinkDto> {
    const ttlSeconds = this.config.get<number>(
      'FILE_SIGNING_TTL_DOCUMENTS',
      60,
    );
    const secret = this.config.getOrThrow<string>('FILE_SIGNING_SECRET');
    const appUrl = this.config.get<string>('APP_URL', '');
    const expiresAt = Date.now() + ttlSeconds * 1000;

    const token = createSignedResourceToken(
      secret,
      { resourceId: document.id, issuedForUserId: actor.id, expiresAt },
      document.storageKey,
    );

    await this.activityLog.record(this.prisma, {
      actorId: actor.id,
      action: 'mission_document.download_link_issued',
      entityType: 'Mission',
      entityId: document.missionId,
      oldValue: null,
      newValue: {
        documentId: document.id,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    });

    return {
      url: `${appUrl}/files/mission-documents/download?token=${encodeURIComponent(token)}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
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

  private async notifyAdminDocumentDeposited(
    missionId: number,
    document: MissionDocumentDto,
  ): Promise<void> {
    const teamEmail = (await this.appSettings.getEffectiveSettings()).teamEmail;
    if (!teamEmail) return;
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      select: { reference: true },
    });
    if (!mission) return;
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '');
    try {
      await this.mailService.sendMissionDocumentDepositedNotification({
        to: teamEmail,
        reference: mission.reference,
        documentType: document.type,
        backOfficeUrl: `${frontendUrl}/missions/${missionId}`,
        relatedEntityId: missionId,
      });
    } catch (error) {
      this.logger.error(
        `Échec de la notification de dépôt de document pour la mission ${mission.reference}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
