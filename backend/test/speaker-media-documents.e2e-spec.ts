import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import sharp from 'sharp';
import { Role, SpeakerStatus, User } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/app.config';
import { createSignedResourceToken } from '../src/common/utils/signed-link.util';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
}
interface MediaItemBody {
  id: number;
  status: string;
  url: string;
}
interface DocumentBody {
  id: number;
  originalFilename: string;
}
interface DownloadLinkBody {
  url: string;
  expiresAt: string;
}
interface PublicSpeakerBody {
  media: { id?: number; url: string; type: string }[];
}

describe('Speaker media & documents API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let config: ConfigService;

  const suffix = Date.now();
  const createdUserIds: number[] = [];
  const createdSpeakerIds: number[] = [];

  let adminUser: User;
  let adminToken: string;
  let speakerAUser: User;
  let speakerAId: number;
  let speakerASlug: string;
  let speakerAToken: string;
  let speakerBToken: string;

  let validImageBuffer: Buffer;
  const validPdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
    'utf-8',
  );

  async function signToken(user: User): Promise<string> {
    return jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async function createSpeakerAccount(
    label: string,
  ): Promise<{ user: User; speakerId: number; token: string }> {
    const user = await prisma.user.create({
      data: {
        email: `e2e-${label}-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const speaker = await prisma.speaker.create({
      data: {
        userId: user.id,
        firstName: label,
        lastName: 'Fixture',
        status: SpeakerStatus.DRAFT,
        isVisible: false,
      },
    });
    createdSpeakerIds.push(speaker.id);
    const token = await signToken(user);
    return { user, speakerId: speaker.id, token };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    config = app.get(ConfigService);

    validImageBuffer = await sharp({
      create: {
        width: 20,
        height: 20,
        channels: 3,
        background: { r: 200, g: 20, b: 20 },
      },
    })
      .jpeg()
      .toBuffer();

    adminUser = await prisma.user.create({
      data: {
        email: `e2e-media-admin-${suffix}@example.com`,
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signToken(adminUser);

    speakerAUser = await prisma.user.create({
      data: {
        email: `e2e-media-a-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(speakerAUser.id);
    speakerASlug = `e2e-media-a-${suffix}`;
    const speakerA = await prisma.speaker.create({
      data: {
        userId: speakerAUser.id,
        firstName: 'Alice',
        lastName: 'Media',
        slug: speakerASlug,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        shortBio: 'Bio',
        publishedAt: new Date(),
      },
    });
    speakerAId = speakerA.id;
    createdSpeakerIds.push(speakerA.id);
    speakerAToken = await signToken(speakerAUser);

    const speakerB = await createSpeakerAccount('media-b');
    speakerBToken = speakerB.token;
  });

  afterAll(async () => {
    await prisma.speakerMedia.deleteMany({
      where: { speakerId: { in: createdSpeakerIds } },
    });
    await prisma.speakerDocument.deleteMany({
      where: { speakerId: { in: createdSpeakerIds } },
    });
    await prisma.speaker.deleteMany({
      where: { id: { in: createdSpeakerIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('Média public : PENDING_REVIEW invisible, visible après approbation', () => {
    let mediaId: number;

    it("un média PENDING_REVIEW n'apparaît pas dans l'API publique", async () => {
      const upload = await request(app.getHttpServer())
        .post('/speaker/me/media')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .field('type', 'PHOTO')
        .attach('file', validImageBuffer, 'photo.jpg')
        .expect(201);
      const body = upload.body as MediaItemBody;
      mediaId = body.id;
      expect(body.status).toBe('PENDING_REVIEW');

      const publicView = await request(app.getHttpServer())
        .get(`/public/speakers/${speakerASlug}`)
        .expect(200);
      const media = (publicView.body as PublicSpeakerBody).media;
      expect(media.find((m) => m.url === body.url)).toBeUndefined();
    });

    it('après approbation admin, le média apparaît dans l’API publique', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/speaker-media/${mediaId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);

      const publicView = await request(app.getHttpServer())
        .get(`/public/speakers/${speakerASlug}`)
        .expect(200);
      const media = (publicView.body as PublicSpeakerBody).media;
      const found = media.find((m) => m.type === 'PHOTO');
      expect(found).toBeDefined();
    });

    it('un média supprimé disparaît immédiatement de l’API publique', async () => {
      await request(app.getHttpServer())
        .delete(`/speaker/me/media/${mediaId}`)
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(204);

      const publicView = await request(app.getHttpServer())
        .get(`/public/speakers/${speakerASlug}`)
        .expect(200);
      const media = (publicView.body as PublicSpeakerBody).media;
      expect(media.find((m) => m.type === 'PHOTO')).toBeUndefined();
    });
  });

  describe('Cloisonnement — 404, jamais 403 (§2)', () => {
    let ownedMediaId: number;
    let ownedDocumentId: number;

    beforeAll(async () => {
      const media = await request(app.getHttpServer())
        .post('/speaker/me/media')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .field('type', 'PHOTO')
        .attach('file', validImageBuffer, 'photo2.jpg')
        .expect(201);
      ownedMediaId = (media.body as MediaItemBody).id;

      const doc = await request(app.getHttpServer())
        .post('/speaker/me/documents')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .field('type', 'CV')
        .attach('file', validPdfBuffer, 'cv.pdf')
        .expect(201);
      ownedDocumentId = (doc.body as DocumentBody).id;
    });

    it('le speaker B reçoit 404 (pas 403) en modifiant le média du speaker A', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/speaker/me/media/${ownedMediaId}`)
        .set('Authorization', `Bearer ${speakerBToken}`)
        .send({ title: 'Tentative' })
        .expect(404);
      expect((res.body as ErrorResponseBody).statusCode).toBe(404);
    });

    it('le speaker B reçoit 404 en supprimant le média du speaker A', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/speaker/me/media/${ownedMediaId}`)
        .set('Authorization', `Bearer ${speakerBToken}`)
        .expect(404);
      expect((res.body as ErrorResponseBody).statusCode).toBe(404);
    });

    it('le speaker B reçoit 404 en demandant un lien de téléchargement pour le document du speaker A', async () => {
      const res = await request(app.getHttpServer())
        .get(`/speaker/me/documents/${ownedDocumentId}/download-link`)
        .set('Authorization', `Bearer ${speakerBToken}`)
        .expect(404);
      expect((res.body as ErrorResponseBody).statusCode).toBe(404);
    });

    it('le speaker B reçoit 404 en supprimant le document du speaker A', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/speaker/me/documents/${ownedDocumentId}`)
        .set('Authorization', `Bearer ${speakerBToken}`)
        .expect(404);
      expect((res.body as ErrorResponseBody).statusCode).toBe(404);
    });
  });

  describe('Validation par magic bytes (§5/§10)', () => {
    it('rejette un press-kit qui n’est pas réellement un PDF, même renommé .pdf', async () => {
      const res = await request(app.getHttpServer())
        .post('/speaker/me/media')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .field('type', 'PRESS_KIT')
        .attach('file', validImageBuffer, 'fake.pdf')
        .expect(415);
      expect((res.body as ErrorResponseBody).statusCode).toBe(415);
    });

    it("rejette un document qui n'est pas réellement un PDF, même renommé .pdf", async () => {
      const notAPdf = Buffer.from('MZ this is not a pdf, just plain bytes');
      const res = await request(app.getHttpServer())
        .post('/speaker/me/documents')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .field('type', 'OTHER')
        .attach('file', notAPdf, 'malicious.pdf')
        .expect(415);
      expect((res.body as ErrorResponseBody).statusCode).toBe(415);
    });

    it('accepte un vrai PDF (magic bytes %PDF-)', async () => {
      const res = await request(app.getHttpServer())
        .post('/speaker/me/documents')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .field('type', 'OTHER')
        .attach('file', validPdfBuffer, 'real.pdf')
        .expect(201);
      expect((res.body as DocumentBody).originalFilename).toBe('real.pdf');
    });

    it('rejette un domaine vidéo non autorisé', async () => {
      const res = await request(app.getHttpServer())
        .post('/speaker/me/media')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .field('type', 'VIDEO')
        .field('url', 'https://evil-video-host.example.com/watch?v=1')
        .expect(400);
      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it('accepte une URL YouTube pour un média VIDEO', async () => {
      const res = await request(app.getHttpServer())
        .post('/speaker/me/media')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .field('type', 'VIDEO')
        .field('url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        .expect(201);
      expect((res.body as MediaItemBody).url).toContain('youtube.com');
    });
  });

  describe('Lien signé de téléchargement (§4/§10)', () => {
    let documentId: number;

    beforeAll(async () => {
      const doc = await request(app.getHttpServer())
        .post('/speaker/me/documents')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .field('type', 'CV')
        .attach('file', validPdfBuffer, 'signed-link-cv.pdf')
        .expect(201);
      documentId = (doc.body as DocumentBody).id;
    });

    it('un lien signé valide permet de télécharger le fichier', async () => {
      const linkRes = await request(app.getHttpServer())
        .get(`/speaker/me/documents/${documentId}/download-link`)
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(200);
      const { url } = linkRes.body as DownloadLinkBody;
      const path = url.replace(/^https?:\/\/[^/]+/, '');

      const download = await request(app.getHttpServer()).get(path).expect(200);
      expect(download.headers['content-type']).toBe('application/pdf');
      expect(Buffer.compare(download.body as Buffer, validPdfBuffer)).toBe(0);
    });

    it('un lien expiré renvoie 410 Gone (temps simulé, pas d’attente réelle)', async () => {
      const documentRow = await prisma.speakerDocument.findUniqueOrThrow({
        where: { id: documentId },
      });
      const secret = config.getOrThrow<string>('FILE_SIGNING_SECRET');
      const expiredToken = createSignedResourceToken(
        secret,
        {
          resourceId: documentId,
          issuedForUserId: speakerAUser.id,
          expiresAt: Date.now() - 1000, // déjà expiré
        },
        documentRow.storageKey,
      );

      const res = await request(app.getHttpServer())
        .get(
          `/files/documents/download?token=${encodeURIComponent(expiredToken)}`,
        )
        .expect(410);
      expect((res.body as ErrorResponseBody).statusCode).toBe(410);
    });

    it('un token altéré (signature invalide) est rejeté', async () => {
      const linkRes = await request(app.getHttpServer())
        .get(`/speaker/me/documents/${documentId}/download-link`)
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(200);
      const { url } = linkRes.body as DownloadLinkBody;
      const tamperedUrl = url.slice(0, -2) + 'xx';
      const path = tamperedUrl.replace(/^https?:\/\/[^/]+/, '');

      await request(app.getHttpServer()).get(path).expect(401);
    });
  });

  describe('Aucun storageKey brut exposé (§10)', () => {
    it('la réponse de liste des documents ne contient jamais storageKey', async () => {
      const res = await request(app.getHttpServer())
        .get('/speaker/me/documents')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(200);

      const rows = await prisma.speakerDocument.findMany({
        where: { speakerId: speakerAId },
        select: { storageKey: true },
      });
      const json = JSON.stringify(res.body);
      for (const row of rows) {
        expect(json).not.toContain(row.storageKey);
      }
      expect(json).not.toContain('storageKey');
    });

    it('la réponse du lien de téléchargement ne contient jamais storageKey', async () => {
      const documentRow = await prisma.speakerDocument.findFirstOrThrow({
        where: { speakerId: speakerAId },
      });
      const res = await request(app.getHttpServer())
        .get(`/speaker/me/documents/${documentRow.id}/download-link`)
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain(documentRow.storageKey);
    });

    it('côté admin, la liste des documents d’un speaker ne contient jamais storageKey', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/speakers/${speakerAId}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rows = await prisma.speakerDocument.findMany({
        where: { speakerId: speakerAId },
        select: { storageKey: true },
      });
      const json = JSON.stringify(res.body);
      for (const row of rows) {
        expect(json).not.toContain(row.storageKey);
      }
      expect(json).not.toContain('storageKey');
    });

    it('côté admin, la réponse du lien de téléchargement ne contient jamais storageKey', async () => {
      const documentRow = await prisma.speakerDocument.findFirstOrThrow({
        where: { speakerId: speakerAId },
      });
      const res = await request(app.getHttpServer())
        .get(`/admin/speaker-documents/${documentRow.id}/download-link`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain(documentRow.storageKey);
    });
  });

  describe('storage/private/ injoignable par une route statique (§4/§10)', () => {
    it("un chemin construit à partir du storageKey réel n'est jamais servi, sous aucun préfixe statique plausible", async () => {
      const documentRow = await prisma.speakerDocument.findFirstOrThrow({
        where: { speakerId: speakerAId },
      });
      // storageKey ressemble à "private/documents/<uuid>.pdf" — /uploads ne
      // sert QUE storage/public/, donc même en connaissant le nom exact du
      // fichier, il reste introuvable, quel que soit le préfixe tenté.
      const relative = documentRow.storageKey.replace(/^private\//, '');
      const full = documentRow.storageKey;

      await request(app.getHttpServer())
        .get(`/uploads/${relative}`)
        .expect(404);
      await request(app.getHttpServer()).get(`/storage/${full}`).expect(404);
      await request(app.getHttpServer()).get(`/files/${full}`).expect(404);
      await request(app.getHttpServer())
        .get(`/private/${relative}`)
        .expect(404);
    });
  });

  describe('Révocation du lien signé à la suppression (consolidation, Partie B)', () => {
    it('un document supprimé APRÈS émission du lien : le lien renvoie 404, aucun octet de fichier renvoyé', async () => {
      const doc = await request(app.getHttpServer())
        .post('/speaker/me/documents')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .field('type', 'OTHER')
        .attach('file', validPdfBuffer, 'to-be-deleted.pdf')
        .expect(201);
      const docId = (doc.body as DocumentBody).id;

      const linkRes = await request(app.getHttpServer())
        .get(`/speaker/me/documents/${docId}/download-link`)
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(200);
      const { url } = linkRes.body as DownloadLinkBody;
      const path = url.replace(/^https?:\/\/[^/]+/, '');

      await request(app.getHttpServer())
        .delete(`/speaker/me/documents/${docId}`)
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(204);

      const res = await request(app.getHttpServer()).get(path).expect(404);
      expect((res.body as ErrorResponseBody).statusCode).toBe(404);
      // Aucun octet de fichier renvoyé : le corps est le JSON d'erreur
      // standard, pas un flux PDF.
      expect(res.headers['content-type']).not.toBe('application/pdf');
    });

    it('un speaker archivé (deletedAt) invalide aussi les liens en cours pour ses documents', async () => {
      const { token, speakerId } = await createSpeakerAccount(
        'revoke-speaker-archived',
      );
      const doc = await request(app.getHttpServer())
        .post('/speaker/me/documents')
        .set('Authorization', `Bearer ${token}`)
        .field('type', 'OTHER')
        .attach('file', validPdfBuffer, 'archived-speaker.pdf')
        .expect(201);
      const docId = (doc.body as DocumentBody).id;

      const linkRes = await request(app.getHttpServer())
        .get(`/speaker/me/documents/${docId}/download-link`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const { url } = linkRes.body as DownloadLinkBody;
      const path = url.replace(/^https?:\/\/[^/]+/, '');

      await prisma.speaker.update({
        where: { id: speakerId },
        data: { deletedAt: new Date() },
      });

      const res = await request(app.getHttpServer()).get(path).expect(404);
      expect((res.body as ErrorResponseBody).statusCode).toBe(404);
    });
  });

  describe('Quotas', () => {
    it('refuse un upload de média au-delà du quota', async () => {
      const { token } = await createSpeakerAccount('quota-media');
      for (let i = 0; i < 20; i += 1) {
        await request(app.getHttpServer())
          .post('/speaker/me/media')
          .set('Authorization', `Bearer ${token}`)
          .field('type', 'VIDEO')
          .field('url', 'https://www.youtube.com/watch?v=quota' + i)
          .expect(201);
      }
      const res = await request(app.getHttpServer())
        .post('/speaker/me/media')
        .set('Authorization', `Bearer ${token}`)
        .field('type', 'VIDEO')
        .field('url', 'https://www.youtube.com/watch?v=onetoomany')
        .expect(400);
      expect((res.body as ErrorResponseBody).message).toContain(
        'Quota atteint',
      );
    }, 30_000);
  });
});
