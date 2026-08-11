import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role, SpeakerStatus, User } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/app.config';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';

interface ErrorResponseBody {
  statusCode: number;
}
interface AnalyticsEventListBody {
  data: { id: number; type: string; speakerId: number | null }[];
  meta: { total: number };
}

// Ces tests prouvent : la capture PROFILE_VIEW/SEARCH (§B3), l'absence
// TOTALE d'IP en clair (§B2), la résilience "fire and forget" (§B4 — une
// panne d'analytics ne doit jamais faire échouer la requête publique
// appelante), et le cloisonnement de l'endpoint admin (§B6).
describe('Analytics API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now();
  const createdUserIds: number[] = [];
  const createdSpeakerIds: number[] = [];
  const createdListIds: number[] = [];

  let adminToken: string;
  let speakerToken: string;
  let publishedSlug: string;
  let publishedListSlug: string;

  async function signToken(user: User): Promise<string> {
    return jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
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

    const adminUser = await prisma.user.create({
      data: {
        email: `e2e-analytics-admin-${suffix}@example.com`,
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signToken(adminUser);

    const speakerUser = await prisma.user.create({
      data: {
        email: `e2e-analytics-speaker-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(speakerUser.id);
    speakerToken = await signToken(speakerUser);

    publishedSlug = `e2e-analytics-${suffix}`;
    const speaker = await prisma.speaker.create({
      data: {
        firstName: 'Analytics',
        lastName: 'Fixture',
        slug: publishedSlug,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        shortBio: 'Bio.',
        publishedAt: new Date(),
      },
    });
    createdSpeakerIds.push(speaker.id);

    publishedListSlug = `e2e-analytics-list-${suffix}`;
    const list = await prisma.curatedList.create({
      data: {
        title: `Analytics List ${suffix}`,
        slug: publishedListSlug,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    createdListIds.push(list.id);
  });

  afterAll(async () => {
    await prisma.analyticsEvent.deleteMany({
      where: { speakerId: { in: createdSpeakerIds } },
    });
    await prisma.analyticsEvent.deleteMany({
      where: { curatedListId: { in: createdListIds } },
    });
    await prisma.curatedList.deleteMany({
      where: { id: { in: createdListIds } },
    });
    await prisma.speaker.deleteMany({
      where: { id: { in: createdSpeakerIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('§B3 — capture des événements', () => {
    it('une consultation de profil public crée un PROFILE_VIEW', async () => {
      await request(app.getHttpServer())
        .get(`/public/speakers/${publishedSlug}`)
        .expect(200);

      // Fire-and-forget : laisser le temps à l'écriture asynchrone de
      // s'exécuter avant de l'interroger.
      await new Promise((resolve) => setTimeout(resolve, 200));

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'PROFILE_VIEW', speakerId: createdSpeakerIds[0] },
      });
      expect(events.length).toBeGreaterThan(0);
    });

    it('une recherche sans résultat crée un SEARCH avec resultCount = 0', async () => {
      const nonsenseSlugFilter = `no-such-pillar-${suffix}`;
      await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ pillar: nonsenseSlugFilter, perPage: 50 })
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const events = await prisma.analyticsEvent.findMany({
        where: { type: 'SEARCH' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      const match = events.find((e) => {
        const payload = e.payload as {
          filters?: { pillar?: string };
          resultCount?: number;
        } | null;
        return payload?.filters?.pillar === nonsenseSlugFilter;
      });
      expect(match).toBeDefined();
      const payload = match?.payload as { resultCount?: number };
      expect(payload.resultCount).toBe(0);
    });
  });

  describe('§B2 — aucune IP en clair', () => {
    it("aucune adresse IPv4 n'apparaît nulle part dans la ligne analytics_events créée", async () => {
      await request(app.getHttpServer())
        .get(`/public/speakers/${publishedSlug}`)
        .expect(200);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const event = await prisma.analyticsEvent.findFirst({
        where: { type: 'PROFILE_VIEW', speakerId: createdSpeakerIds[0] },
        orderBy: { createdAt: 'desc' },
      });
      expect(event).not.toBeNull();

      const json = JSON.stringify(event);
      // Motif IPv4 générique — s'il apparaît, une IP brute a fuité quelque part.
      expect(json).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
      // visitorHash est un digest hex SHA-256 (64 caractères), pas une IP.
      expect(event?.visitorHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('§B4 — résilience "fire and forget"', () => {
    it("POST /public/analytics/events avec un speakerSlug inconnu reste 202, aucun événement n'est écrit", async () => {
      const before = await prisma.analyticsEvent.count();

      const res = await request(app.getHttpServer())
        .post('/public/analytics/events')
        .send({
          type: 'CHECK_AVAILABILITY_CLICK',
          speakerSlug: `ce-slug-n-existe-pas-${suffix}`,
        })
        .expect(202);
      expect(res.body).toEqual({ accepted: true });

      await new Promise((resolve) => setTimeout(resolve, 200));
      const after = await prisma.analyticsEvent.count();
      expect(after).toBe(before);
    });

    it('une panne volontaire du service analytics ne fait pas échouer GET /public/speakers/:slug', async () => {
      // Instance NestJS SÉPARÉE, avec AnalyticsService remplacé par un mock
      // qui THROW de façon synchrone — reproduit fidèlement "une erreur
      // volontaire du service d'analytics" sans dépendre d'un état DB
      // particulier. Le filet fireAndForget (voir
      // modules/analytics/fire-and-forget.util.ts) doit absorber ce throw.
      const brokenModule: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(AnalyticsService)
        .useValue({
          record: () => {
            throw new Error('Erreur volontaire de test');
          },
        })
        .compile();

      const brokenApp: INestApplication<App> =
        brokenModule.createNestApplication();
      configureApp(brokenApp);
      await brokenApp.init();

      try {
        await request(brokenApp.getHttpServer())
          .get(`/public/speakers/${publishedSlug}`)
          .expect(200);
      } finally {
        await brokenApp.close();
      }
    });
  });

  describe('Partie C (consolidation) — référencer par slug, résolu côté serveur', () => {
    it('speakerSlug connu est résolu en id interne — la ligne créée référence le bon speaker', async () => {
      await request(app.getHttpServer())
        .post('/public/analytics/events')
        .send({ type: 'CHECK_AVAILABILITY_CLICK', speakerSlug: publishedSlug })
        .expect(202);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const event = await prisma.analyticsEvent.findFirst({
        where: {
          type: 'CHECK_AVAILABILITY_CLICK',
          speakerId: createdSpeakerIds[0],
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(event).not.toBeNull();
    });

    it('curatedListSlug connu est résolu en id interne — la ligne créée référence la bonne liste', async () => {
      await request(app.getHttpServer())
        .post('/public/analytics/events')
        .send({ type: 'CURATED_LIST_VIEW', curatedListSlug: publishedListSlug })
        .expect(202);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const event = await prisma.analyticsEvent.findFirst({
        where: { type: 'CURATED_LIST_VIEW', curatedListId: createdListIds[0] },
        orderBy: { createdAt: 'desc' },
      });
      expect(event).not.toBeNull();
    });

    it('curatedListSlug inconnu (ou liste DRAFT) reste 202, aucun événement écrit', async () => {
      const draftList = await prisma.curatedList.create({
        data: {
          title: `Draft List ${suffix}`,
          slug: `e2e-draft-list-${suffix}`,
        },
      });
      createdListIds.push(draftList.id);

      const before = await prisma.analyticsEvent.count();
      const res = await request(app.getHttpServer())
        .post('/public/analytics/events')
        .send({ type: 'CURATED_LIST_VIEW', curatedListSlug: draftList.slug })
        .expect(202);
      expect(res.body).toEqual({ accepted: true });

      await new Promise((resolve) => setTimeout(resolve, 200));
      const after = await prisma.analyticsEvent.count();
      expect(after).toBe(before);
    });

    it('un id numérique direct (speakerId) est rejeté (400) — la surface publique ne connaît QUE des slugs', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/analytics/events')
        .send({
          type: 'CHECK_AVAILABILITY_CLICK',
          speakerId: createdSpeakerIds[0],
        })
        .expect(400);
      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it("la réponse ne contient jamais d'identifiant interne, dans aucun des deux sens", async () => {
      const res = await request(app.getHttpServer())
        .post('/public/analytics/events')
        .send({ type: 'CHECK_AVAILABILITY_CLICK', speakerSlug: publishedSlug })
        .expect(202);
      // Requête : uniquement un slug (voir ci-dessus). Réponse : forme fixe,
      // jamais l'id résolu en interne.
      expect(res.body).toEqual({ accepted: true });
    });
  });

  describe('§B6 — GET /admin/analytics/events', () => {
    it('liste paginée, filtrable par type, réservée ADMIN/SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/analytics/events')
        .query({ type: 'PROFILE_VIEW', perPage: 5 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as AnalyticsEventListBody;
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.every((e) => e.type === 'PROFILE_VIEW')).toBe(true);
    });

    it('refuse un token SPEAKER', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/analytics/events')
        .set('Authorization', `Bearer ${speakerToken}`)
        .expect(403);
      expect((res.body as ErrorResponseBody).statusCode).toBe(403);
    });
  });
});
