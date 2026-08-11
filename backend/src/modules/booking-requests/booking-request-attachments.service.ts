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
import { BookingRequestAttachment } from '@prisma/client';
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
import { toAttachmentDto } from './mappers/booking-request.mapper';
import { BookingRequestAttachmentDto } from './dto/outputs/booking-request-attachment.dto';
import { DownloadLinkDto } from './dto/outputs/download-link.dto';
import {
  ATTACHMENT_EXTENSION_BY_MIME,
  ATTACHMENT_MAX_SIZE_BYTES,
  ATTACHMENT_SUBDIR,
} from './booking-request-attachments.constants';

const ATTACHMENT_ADMIN_INCLUDE = {
  uploadedBy: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} as const;

// RÉUTILISE intégralement la brique de stockage privé de la Phase 2c
// (§2.4) : StorageService.savePrivate, validation par magic bytes, liens
// signés HMAC via le util générique commun (voir
// common/utils/signed-link.util.ts, extrait de speaker-documents en Phase
// 3b), et la revalidation en base avant streaming. Accès strictement
// ADMIN/SUPER_ADMIN — appliqué au niveau des contrôleurs, jamais de route
// publique, jamais de rôle SPEAKER.
@Injectable()
export class BookingRequestAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly storage: StorageService,
    private readonly fileValidation: FileValidationService,
    private readonly config: ConfigService,
  ) {}

  async listForRequest(
    requestId: number,
  ): Promise<BookingRequestAttachmentDto[]> {
    const exists = await this.prisma.bookingRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Demande ${requestId} introuvable.`);
    }

    const rows = await this.prisma.bookingRequestAttachment.findMany({
      where: { requestId, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
      include: ATTACHMENT_ADMIN_INCLUDE,
    });
    return rows.map(toAttachmentDto);
  }

  async upload(
    requestId: number,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedUser,
  ): Promise<BookingRequestAttachmentDto> {
    const request = await this.prisma.bookingRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    });
    if (!request) {
      throw new NotFoundException(`Demande ${requestId} introuvable.`);
    }

    if (!file) {
      throw new BadRequestException('Fichier requis (champ "file").');
    }
    if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
      throw new BadRequestException('Fichier trop volumineux (20 Mo maximum).');
    }

    // Types acceptés : PDF, images, documents bureautiques courants (§2.4)
    // — vérifié par CONTENU réel, jamais par l'extension du fichier envoyé.
    const mimeType = await this.fileValidation.detectAllowedType(
      file.buffer,
      ATTACHMENT_ALLOWED_MIME_TYPES,
    );
    const ext = ATTACHMENT_EXTENSION_BY_MIME[mimeType] ?? 'bin';

    // Nom généré côté serveur : jamais le nom original, qui n'est conservé
    // qu'en base pour l'affichage (originalFilename), jamais utilisé pour
    // construire un chemin disque.
    const storageKey = await this.storage.savePrivate(
      file.buffer,
      ATTACHMENT_SUBDIR,
      `${randomUUID()}.${ext}`,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.bookingRequestAttachment.create({
        data: {
          requestId,
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
        action: 'booking_request.attachment_uploaded',
        entityType: 'BookingRequest',
        entityId: requestId,
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
    requestId: number,
    attachmentId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookingRequestAttachment.findFirst({
        where: { id: attachmentId, requestId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(
          `Pièce jointe ${attachmentId} introuvable.`,
        );
      }

      // Soft delete uniquement — le fichier physique dans storage/private/
      // n'est pas supprimé à cette étape (même principe que speaker_documents).
      const deletedAt = new Date();
      await tx.bookingRequestAttachment.update({
        where: { id: attachmentId },
        data: { deletedAt },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'booking_request.attachment_deleted',
        entityType: 'BookingRequest',
        entityId: requestId,
        oldValue: { attachmentId, deletedAt: null },
        newValue: { attachmentId, deletedAt: deletedAt.toISOString() },
      });
    });
  }

  async createDownloadLink(
    requestId: number,
    attachmentId: number,
    actor: AuthenticatedUser,
  ): Promise<DownloadLinkDto> {
    const attachment = await this.prisma.bookingRequestAttachment.findFirst({
      where: { id: attachmentId, requestId, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException(`Pièce jointe ${attachmentId} introuvable.`);
    }

    // Même TTL court que les documents privés speaker (§2.4 — réutilise la
    // brique de la Phase 2c telle quelle, y compris ce réglage).
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
      action: 'booking_request.attachment_download_link_issued',
      entityType: 'BookingRequest',
      entityId: requestId,
      oldValue: null,
      newValue: { attachmentId, expiresAt: new Date(expiresAt).toISOString() },
    });

    return {
      url: `${appUrl}/files/booking-attachments/download?token=${encodeURIComponent(token)}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  // Même principe que SpeakerDocumentsService#resolveDownload (voir les
  // commentaires là-bas pour le détail) : la signature est vérifiée en
  // premier (sans état), la survie de la ressource en DERNIER — une pièce
  // jointe supprimée APRÈS l'émission du lien redevient introuvable (404),
  // jamais "expirée" (410, qui serait trompeur ici).
  async resolveDownload(
    token: string,
  ): Promise<{ attachment: BookingRequestAttachment; stream: Readable }> {
    const decoded = decodeSignedResourceToken(token);
    if (!decoded.ok) {
      throw new UnauthorizedException('Lien de téléchargement invalide.');
    }

    const attachment = await this.prisma.bookingRequestAttachment.findUnique({
      where: { id: decoded.payload.resourceId },
    });
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
