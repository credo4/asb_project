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
import { SpeakerDocument } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StorageService } from '../../storage/storage.service';
import { FileValidationService } from '../media/file-validation.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { resolveOwnSpeakerId } from '../speakers/resolve-own-speaker.util';
import { DOCUMENT_ADMIN_INCLUDE } from './speaker-documents.includes';
import {
  scalarSnapshot,
  toAdminDto,
  toOwnDto,
} from './mappers/speaker-document.mapper';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SpeakerDocumentDto } from './dto/outputs/speaker-document.dto';
import { AdminDocumentDto } from './dto/outputs/admin-document.dto';
import { DownloadLinkDto } from './dto/outputs/download-link.dto';
import {
  createSignedResourceToken,
  decodeSignedResourceToken,
  isResourceSignatureValid,
} from '../../common/utils/signed-link.util';
import {
  DEFAULT_FILE_SIGNING_TTL_DOCUMENTS_SECONDS,
  DOCUMENT_MAX_SIZE_BYTES,
  DOCUMENT_QUOTA_PER_SPEAKER,
  DOCUMENT_SUBDIR,
} from './speaker-documents.constants';

@Injectable()
export class SpeakerDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly storage: StorageService,
    private readonly fileValidation: FileValidationService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------------
  // Self-service SPEAKER
  // ---------------------------------------------------------------------

  async listOwn(actor: AuthenticatedUser): Promise<SpeakerDocumentDto[]> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    // `select` explicite, SANS storageKey : même principe que
    // public-speaker.select.ts — le champ n'est même pas chargé depuis la
    // base pour cette liste, rien à oublier de retirer plus tard.
    const rows = await this.prisma.speakerDocument.findMany({
      where: { speakerId, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        type: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        uploadedAt: true,
      },
    });
    return rows.map(toOwnDto);
  }

  async uploadOwn(
    actor: AuthenticatedUser,
    dto: CreateDocumentDto,
    file: Express.Multer.File | undefined,
  ): Promise<SpeakerDocumentDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);

    if (!file) {
      throw new BadRequestException('Fichier requis (champ "file").');
    }
    if (file.size > DOCUMENT_MAX_SIZE_BYTES) {
      throw new BadRequestException('Fichier trop volumineux (20 Mo maximum).');
    }

    const activeCount = await this.prisma.speakerDocument.count({
      where: { speakerId, deletedAt: null },
    });
    if (activeCount >= DOCUMENT_QUOTA_PER_SPEAKER) {
      throw new BadRequestException(
        `Quota atteint : ${DOCUMENT_QUOTA_PER_SPEAKER} documents maximum par profil.`,
      );
    }

    // PDF uniquement dans un premier temps (§5) — vérifié par contenu réel
    // (magic bytes), jamais par l'extension du fichier envoyé.
    await this.fileValidation.assertIsPdf(file.buffer);

    // Nom généré côté serveur : jamais le nom original, qui n'est conservé
    // qu'en base pour l'affichage (originalFilename), jamais utilisé pour
    // construire un chemin disque.
    const storageKey = await this.storage.savePrivate(
      file.buffer,
      DOCUMENT_SUBDIR,
      `${randomUUID()}.pdf`,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.speakerDocument.create({
        data: {
          speakerId,
          type: dto.type,
          storageKey,
          originalFilename: file.originalname,
          mimeType: 'application/pdf',
          sizeBytes: file.size,
        },
      });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_document.uploaded',
        entityType: 'SpeakerDocument',
        entityId: row.id,
        oldValue: null,
        newValue: scalarSnapshot(row),
      });

      return row;
    });

    return toOwnDto(created);
  }

  async removeOwn(actor: AuthenticatedUser, id: number): Promise<void> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.speakerDocument.findFirst({
        where: { id, speakerId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Document ${id} introuvable.`);
      }

      // Soft delete uniquement (§8) — le fichier physique dans
      // storage/private/ n'est pas supprimé à cette étape ; un job de
      // nettoyage des orphelins viendra plus tard.
      const deletedAt = new Date();
      await tx.speakerDocument.update({ where: { id }, data: { deletedAt } });

      await this.activityLog.record(tx, {
        actorId: actor.id,
        action: 'speaker_document.deleted',
        entityType: 'SpeakerDocument',
        entityId: id,
        oldValue: { deletedAt: null },
        newValue: { deletedAt: deletedAt.toISOString() },
      });
    });
  }

  async createOwnDownloadLink(
    actor: AuthenticatedUser,
    id: number,
  ): Promise<DownloadLinkDto> {
    const speakerId = await resolveOwnSpeakerId(this.prisma, actor.id);
    const document = await this.prisma.speakerDocument.findFirst({
      where: { id, speakerId, deletedAt: null },
    });
    if (!document) {
      throw new NotFoundException(`Document ${id} introuvable.`);
    }
    return this.mintLink(document, actor);
  }

  // ---------------------------------------------------------------------
  // Admin — accès à N'IMPORTE QUEL speaker (pas de scoping par propriété,
  // seul un rôle ADMIN/SUPER_ADMIN donne cet accès, cf. §4).
  // ---------------------------------------------------------------------

  async listForAdmin(speakerId: number): Promise<AdminDocumentDto[]> {
    const speakerExists = await this.prisma.speaker.findFirst({
      where: { id: speakerId, deletedAt: null },
      select: { id: true },
    });
    if (!speakerExists) {
      throw new NotFoundException(`Speaker ${speakerId} introuvable.`);
    }

    const rows = await this.prisma.speakerDocument.findMany({
      where: { speakerId, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
      include: DOCUMENT_ADMIN_INCLUDE,
    });
    return rows.map(toAdminDto);
  }

  async createAdminDownloadLink(
    actor: AuthenticatedUser,
    id: number,
  ): Promise<DownloadLinkDto> {
    const document = await this.prisma.speakerDocument.findFirst({
      where: { id, deletedAt: null },
    });
    if (!document) {
      throw new NotFoundException(`Document ${id} introuvable.`);
    }
    return this.mintLink(document, actor);
  }

  private async mintLink(
    document: SpeakerDocument,
    actor: AuthenticatedUser,
  ): Promise<DownloadLinkDto> {
    // TTL spécifique aux documents (60s par défaut), pas le défaut général
    // (5 min) — un CV/une attestation n'a pas besoin de vivre aussi
    // longtemps qu'un lien de média (consolidation Phase 2, Partie B).
    const ttlSeconds = this.config.get<number>(
      'FILE_SIGNING_TTL_DOCUMENTS',
      DEFAULT_FILE_SIGNING_TTL_DOCUMENTS_SECONDS,
    );
    const secret = this.config.getOrThrow<string>('FILE_SIGNING_SECRET');
    const appUrl = this.config.get<string>('APP_URL', '');
    const expiresAt = Date.now() + ttlSeconds * 1000;

    const token = createSignedResourceToken(
      secret,
      { resourceId: document.id, issuedForUserId: actor.id, expiresAt },
      document.storageKey,
    );

    // Génération d'un lien de téléchargement = donnée d'audit à part
    // entière (§9), pas un détail de confort : on journalise CHAQUE
    // émission, pas seulement les téléchargements effectifs.
    await this.activityLog.record(this.prisma, {
      actorId: actor.id,
      action: 'speaker_document.download_link_issued',
      entityType: 'SpeakerDocument',
      entityId: document.id,
      oldValue: null,
      newValue: { expiresAt: new Date(expiresAt).toISOString() },
    });

    return {
      url: `${appUrl}/files/documents/download?token=${encodeURIComponent(token)}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  // ---------------------------------------------------------------------
  // Streaming — appelé par le controller @Public() dédié. La vérification
  // d'appartenance/de rôle a déjà eu lieu UNE FOIS, au moment de la
  // génération du lien (mintLink) : ici, on ne revalide QUE l'intégrité et
  // l'expiration du token lui-même — c'est tout le principe d'un lien signé
  // "sans état" (voir signed-link.util.ts). MAIS un HMAC sans état ne peut
  // pas être révoqué : si la ressource a été supprimée APRÈS l'émission du
  // lien, la signature reste mathématiquement valide jusqu'à expiration —
  // d'où la relecture de la ligne en base, en dernier, après la vérif
  // cryptographique (consolidation Phase 2, Partie B).
  // ---------------------------------------------------------------------

  async resolveDownload(
    token: string,
  ): Promise<{ document: SpeakerDocument; stream: Readable }> {
    const decoded = decodeSignedResourceToken(token);
    if (!decoded.ok) {
      throw new UnauthorizedException('Lien de téléchargement invalide.');
    }

    // SANS filtre deletedAt ici, volontairement : on a besoin du storageKey
    // (même d'un document/speaker supprimé) pour recalculer la signature
    // attendue — la vérif de "toujours vivant" vient APRÈS, une fois la
    // signature confirmée authentique.
    const document = await this.prisma.speakerDocument.findUnique({
      where: { id: decoded.payload.resourceId },
      include: { speaker: { select: { deletedAt: true } } },
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

    // Signature authentique confirmée : SEULEMENT maintenant on vérifie
    // l'expiration (410, "le lien a expiré") puis la survie de la ressource
    // (404, "n'existe plus" — jamais 410 ici, ce serait trompeur : le lien
    // n'a pas expiré, la ressource a disparu).
    if (Date.now() > decoded.payload.expiresAt) {
      throw new GoneException('Ce lien de téléchargement a expiré.');
    }

    if (document.deletedAt !== null || document.speaker.deletedAt !== null) {
      throw new NotFoundException('Document introuvable.');
    }

    const stream = await this.storage.streamPrivate(document.storageKey);
    return { document, stream };
  }
}
