import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role, SpeakerStatus, User } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/app.config';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
}
interface AdminListDetailBody {
  id: number;
  title: string;
  slug: string;
  status: string;
  members: { speakerId: number; slug: string | null; status: string }[];
}
interface PublicListItemBody {
  slug: string;
  title: string;
}
interface PublicListDetailBody {
  slug: string;
  title: string;
  speakers: { slug: string }[];
}

// Couvre le prompt "consolidation avant la suite de la Phase 3", Partie B :
// CRUD admin complet, workflow DRAFT<->PUBLISHED, réordonnancement des
// membres (permutation exacte), et LA règle critique de §B4 — un speaker
// non publié/masqué n'apparaît JAMAIS dans une liste éditoriale publiée,
// filtré côté serveur.
describe('Curated lists API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now();
  const createdUserIds: number[] = [];
  const createdSpeakerIds: number[] = [];
  const createdListIds: number[] = [];

  let adminToken: string;
  let speakerToken: string;
  let publishedSpeakerId: number;
  let publishedSpeakerSlug: string;
  let draftSpeakerId: number;

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
        email: `e2e-curated-admin-${suffix}@example.com`,
        role: Role.ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signToken(adminUser);

    const speakerUser = await prisma.user.create({
      data: {
        email: `e2e-curated-speaker-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(speakerUser.id);
    speakerToken = await signToken(speakerUser);

    publishedSpeakerSlug = `e2e-curated-published-${suffix}`;
    const published = await prisma.speaker.create({
      data: {
        firstName: 'Published',
        lastName: 'Member',
        slug: publishedSpeakerSlug,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        shortBio: 'Bio.',
        publishedAt: new Date(),
      },
    });
    publishedSpeakerId = published.id;
    createdSpeakerIds.push(published.id);

    const draft = await prisma.speaker.create({
      data: {
        firstName: 'Draft',
        lastName: 'Member',
        slug: `e2e-curated-draft-${suffix}`,
        status: SpeakerStatus.DRAFT,
        isVisible: false,
      },
    });
    draftSpeakerId = draft.id;
    createdSpeakerIds.push(draft.id);
  });

  afterAll(async () => {
    await prisma.curatedListSpeaker.deleteMany({
      where: { listId: { in: createdListIds } },
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

  async function createList(title: string): Promise<AdminListDetailBody> {
    const res = await request(app.getHttpServer())
      .post('/admin/curated-lists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title })
      .expect(201);
    const body = res.body as AdminListDetailBody;
    createdListIds.push(body.id);
    return body;
  }

  describe('Admin — CRUD', () => {
    it('crée une liste avec un slug auto-généré, réservé ADMIN/SUPER_ADMIN', async () => {
      const list = await createList(`Top Fintech Voices ${suffix}`);
      expect(list.slug).toContain('top-fintech-voices');
      expect(list.status).toBe('DRAFT');
    });

    it('refuse la création pour un rôle SPEAKER', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/curated-lists')
        .set('Authorization', `Bearer ${speakerToken}`)
        .send({ title: 'Should Not Work' })
        .expect(403);
      expect((res.body as ErrorResponseBody).statusCode).toBe(403);
    });

    it('met à jour titre/description', async () => {
      const list = await createList(`Editable List ${suffix}`);
      const res = await request(app.getHttpServer())
        .patch(`/admin/curated-lists/${list.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Nouvelle description.' })
        .expect(200);
      expect((res.body as { description: string }).description).toBe(
        'Nouvelle description.',
      );
    });

    it("ajoute un membre DRAFT sans erreur (le filtrage est à la lecture publique, pas à l'ajout)", async () => {
      const list = await createList(`Draft Allowed ${suffix}`);
      const res = await request(app.getHttpServer())
        .post(`/admin/curated-lists/${list.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: draftSpeakerId })
        .expect(201);
      const body = res.body as AdminListDetailBody;
      expect(body.members.map((m) => m.speakerId)).toContain(draftSpeakerId);
    });

    it('refuse un doublon de membre (409)', async () => {
      const list = await createList(`No Duplicate ${suffix}`);
      await request(app.getHttpServer())
        .post(`/admin/curated-lists/${list.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: publishedSpeakerId })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/admin/curated-lists/${list.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: publishedSpeakerId })
        .expect(409);
    });

    it('réordonne les membres — exige une permutation exacte', async () => {
      const list = await createList(`Reorder Test ${suffix}`);
      await request(app.getHttpServer())
        .post(`/admin/curated-lists/${list.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: publishedSpeakerId })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/admin/curated-lists/${list.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: draftSpeakerId })
        .expect(201);

      // Permutation incomplète -> 400.
      await request(app.getHttpServer())
        .put(`/admin/curated-lists/${list.id}/members/reorder`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderedSpeakerIds: [publishedSpeakerId] })
        .expect(400);

      const res = await request(app.getHttpServer())
        .put(`/admin/curated-lists/${list.id}/members/reorder`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderedSpeakerIds: [draftSpeakerId, publishedSpeakerId] })
        .expect(200);
      const body = res.body as AdminListDetailBody;
      expect(body.members[0].speakerId).toBe(draftSpeakerId);
      expect(body.members[1].speakerId).toBe(publishedSpeakerId);
    });

    it('retire un membre', async () => {
      const list = await createList(`Remove Member ${suffix}`);
      await request(app.getHttpServer())
        .post(`/admin/curated-lists/${list.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: publishedSpeakerId })
        .expect(201);
      const res = await request(app.getHttpServer())
        .delete(`/admin/curated-lists/${list.id}/members/${publishedSpeakerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((res.body as AdminListDetailBody).members).toHaveLength(0);
    });

    it('workflow DRAFT -> PUBLISHED -> DRAFT', async () => {
      const list = await createList(`Publish Workflow ${suffix}`);
      const published = await request(app.getHttpServer())
        .patch(`/admin/curated-lists/${list.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PUBLISHED' })
        .expect(200);
      expect((published.body as { status: string }).status).toBe('PUBLISHED');
      expect(
        (published.body as { publishedAt: string | null }).publishedAt,
      ).not.toBeNull();

      const unpublished = await request(app.getHttpServer())
        .patch(`/admin/curated-lists/${list.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DRAFT' })
        .expect(200);
      expect((unpublished.body as { status: string }).status).toBe('DRAFT');
    });

    it('suppression douce — la liste disparaît de GET /admin/curated-lists/:id', async () => {
      const list = await createList(`Soft Delete ${suffix}`);
      await request(app.getHttpServer())
        .delete(`/admin/curated-lists/${list.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
      await request(app.getHttpServer())
        .get(`/admin/curated-lists/${list.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Public — règle critique du §B4', () => {
    it('GET /public/curated-lists ne renvoie QUE les listes PUBLISHED', async () => {
      const draftList = await createList(`Draft Not Public ${suffix}`);
      const publishedList = await createList(`Published Is Public ${suffix}`);
      await request(app.getHttpServer())
        .patch(`/admin/curated-lists/${publishedList.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PUBLISHED' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/public/curated-lists')
        .expect(200);
      const titles = (res.body as PublicListItemBody[]).map((l) => l.title);
      expect(titles).toContain(publishedList.title);
      expect(titles).not.toContain(draftList.title);
    });

    it('GET /public/curated-lists/:slug renvoie 404 pour une liste DRAFT (jamais 403)', async () => {
      const draftList = await createList(`Draft Detail 404 ${suffix}`);
      const res = await request(app.getHttpServer())
        .get(`/public/curated-lists/${draftList.slug}`)
        .expect(404);
      expect((res.body as ErrorResponseBody).statusCode).toBe(404);
    });

    it(
      "RÈGLE CRITIQUE : un speaker DRAFT membre d'une liste PUBLIÉE n'apparaît JAMAIS " +
        'dans la réponse publique — filtré côté serveur',
      async () => {
        const list = await createList(`Mixed Members ${suffix}`);
        await request(app.getHttpServer())
          .post(`/admin/curated-lists/${list.id}/members`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ speakerId: publishedSpeakerId })
          .expect(201);
        await request(app.getHttpServer())
          .post(`/admin/curated-lists/${list.id}/members`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ speakerId: draftSpeakerId })
          .expect(201);
        await request(app.getHttpServer())
          .patch(`/admin/curated-lists/${list.id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'PUBLISHED' })
          .expect(200);

        const res = await request(app.getHttpServer())
          .get(`/public/curated-lists/${list.slug}`)
          .expect(200);
        const body = res.body as PublicListDetailBody;
        const slugs = body.speakers.map((s) => s.slug);
        expect(slugs).toContain(publishedSpeakerSlug);
        expect(slugs).toHaveLength(1); // le membre DRAFT est absent, pas juste masqué
      },
    );

    it('la réponse publique ne contient aucun champ interne (id, status, memberCount...)', async () => {
      const list = await createList(`No Leak ${suffix}`);
      await request(app.getHttpServer())
        .post(`/admin/curated-lists/${list.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: publishedSpeakerId })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/admin/curated-lists/${list.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PUBLISHED' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/public/curated-lists/${list.slug}`)
        .expect(200);
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('"id"');
      expect(json).not.toContain('selectionMode');
      expect(json).not.toContain('memberCount');
      expect(json).not.toContain('"status"');
    });
  });
});
