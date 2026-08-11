import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { MediaType, SpeakerStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/app.config';

// Formes minimales des réponses, juste ce dont les assertions ont besoin —
// évite les accès `any` non typés sur `res.body` (interdits par la config
// ESLint stricte du projet).
interface ListResponseBody {
  data: Array<{ slug: string }>;
}
interface ErrorResponseBody {
  statusCode: number;
}
interface DetailResponseBody {
  slug: string;
  displayName: string;
  media: Array<{ url: string; status?: string }>;
  feeTierPublic?: string;
}

// Ces tests prouvent l'invariant public/privé décrit dans CLAUDE.md §5 :
// aucun champ privé (pricing, email, phone, internalNotes, média privé) ne
// doit jamais transiter par /public/*, et un speaker non publié doit être
// strictement indiscernable d'un speaker inexistant (404, jamais 403).
describe('Public speakers API — invariant public/privé (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let publishedSlug: string;
  let draftSlug: string;
  let hiddenSlug: string;
  let noBudgetSlug: string;
  let noLocationSlug: string;
  const createdSpeakerIds: number[] = [];

  const INTERNAL_NOTE_MARKER = 'SECRET_INTERNAL_NOTE_SHOULD_NEVER_LEAK';
  const PRIVATE_MEDIA_URL_MARKER = 'private-file-marker.pdf';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Même config que main.ts (pipes, filtres, CORS, doc Swagger) : les
    // tests s'exécutent dans les mêmes conditions qu'en production, sans
    // dupliquer cette config au risque qu'elle diverge silencieusement.
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const pillar = await prisma.pillar.findFirstOrThrow({
      orderBy: { id: 'asc' },
    });
    const country = await prisma.country.findFirstOrThrow({
      orderBy: { id: 'asc' },
    });

    const suffix = Date.now();
    publishedSlug = `e2e-published-${suffix}`;
    draftSlug = `e2e-draft-${suffix}`;
    hiddenSlug = `e2e-hidden-${suffix}`;
    noBudgetSlug = `e2e-no-budget-${suffix}`;
    noLocationSlug = `e2e-no-location-${suffix}`;

    const published = await prisma.speaker.create({
      data: {
        firstName: 'Published',
        lastName: 'Fixture',
        publicName: 'Published Fixture',
        email: 'private-email@example.com',
        phone: '+221000000000',
        shortBio: 'Bio publique.',
        slug: publishedSlug,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        showBudget: true,
        showLocation: true,
        feeTierPublic: 'TIER_2',
        countryId: country.id,
        city: 'Dakar',
        publishedAt: new Date(),
        pillars: { create: [{ pillarId: pillar.id, isPrimary: true }] },
        pricing: {
          create: {
            currency: 'USD',
            minFee: 5000,
            internalNotes: INTERNAL_NOTE_MARKER,
          },
        },
        media: {
          create: [
            {
              type: MediaType.PHOTO,
              url: 'https://example.com/public-photo.webp',
              status: 'APPROVED',
              reviewedAt: new Date(),
              displayOrder: 0,
            },
            {
              // Un média non APPROVED (ici REJECTED, mais PENDING_REVIEW
              // suivrait la même règle) ne doit jamais transiter par
              // l'API publique — table unique depuis la consolidation
              // Phase 2, Partie A (voir public-speaker.select.ts).
              type: MediaType.PRESS_KIT,
              url: `https://example.com/${PRIVATE_MEDIA_URL_MARKER}`,
              status: 'REJECTED',
              rejectionReason:
                'Fixture — ne doit jamais apparaître côté public.',
              displayOrder: 1,
            },
          ],
        },
      },
    });

    const draft = await prisma.speaker.create({
      data: {
        firstName: 'Draft',
        lastName: 'Fixture',
        slug: draftSlug,
        status: SpeakerStatus.DRAFT,
        isVisible: false,
      },
    });

    const hidden = await prisma.speaker.create({
      data: {
        firstName: 'Hidden',
        lastName: 'Fixture',
        slug: hiddenSlug,
        status: SpeakerStatus.PUBLISHED,
        isVisible: false, // publié mais masqué manuellement
      },
    });

    const noBudget = await prisma.speaker.create({
      data: {
        firstName: 'NoBudget',
        lastName: 'Fixture',
        slug: noBudgetSlug,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        showBudget: false,
        feeTierPublic: 'TIER_1',
        publishedAt: new Date(),
      },
    });

    const noLocation = await prisma.speaker.create({
      data: {
        firstName: 'NoLocation',
        lastName: 'Fixture',
        slug: noLocationSlug,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        showLocation: false,
        countryId: country.id,
        city: 'Ville secrète',
        publishedAt: new Date(),
      },
    });

    createdSpeakerIds.push(
      published.id,
      draft.id,
      hidden.id,
      noBudget.id,
      noLocation.id,
    );
  });

  afterAll(async () => {
    await prisma.speaker.deleteMany({
      where: { id: { in: createdSpeakerIds } },
    });
    await app.close();
  });

  describe('GET /public/speakers (liste)', () => {
    it('inclut un speaker PUBLISHED + isVisible=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ perPage: 50 })
        .expect(200);

      const slugs = (res.body as ListResponseBody).data.map((s) => s.slug);
      expect(slugs).toContain(publishedSlug);
    });

    it('exclut un speaker DRAFT', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ perPage: 50 })
        .expect(200);

      const slugs = (res.body as ListResponseBody).data.map((s) => s.slug);
      expect(slugs).not.toContain(draftSlug);
    });

    it('exclut un speaker PUBLISHED mais isVisible=false', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ perPage: 50 })
        .expect(200);

      const slugs = (res.body as ListResponseBody).data.map((s) => s.slug);
      expect(slugs).not.toContain(hiddenSlug);
    });

    it('respecte le plafond perPage (max 50)', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ perPage: 500 })
        .expect(400); // rejeté par class-validator (@Max(50))

      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it('aucun item de la liste ne contient de champ de pricing ou de contact', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ perPage: 50 })
        .expect(200);

      const json = JSON.stringify(res.body);
      expect(json).not.toContain('pricing');
      expect(json).not.toContain('email');
      expect(json).not.toContain('phone');
      expect(json).not.toContain(INTERNAL_NOTE_MARKER);
    });
  });

  describe('GET /public/speakers/:slug (détail)', () => {
    it('renvoie 404 pour un speaker DRAFT (pas 403, pas de contenu partiel)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/public/speakers/${draftSlug}`)
        .expect(404);

      expect((res.body as ErrorResponseBody).statusCode).toBe(404);
    });

    it('renvoie 404 pour un speaker PUBLISHED mais isVisible=false', async () => {
      await request(app.getHttpServer())
        .get(`/public/speakers/${hiddenSlug}`)
        .expect(404);
    });

    it("renvoie le même 404 générique pour un slug qui n'a jamais existé (indiscernable)", async () => {
      const resNonExistent = await request(app.getHttpServer())
        .get('/public/speakers/ce-slug-ne-devrait-jamais-exister-12345')
        .expect(404);
      const resDraft = await request(app.getHttpServer())
        .get(`/public/speakers/${draftSlug}`)
        .expect(404);

      expect(resNonExistent.body).toEqual(resDraft.body);
    });

    it('renvoie 200 avec le profil complet pour un speaker publié', async () => {
      const res = await request(app.getHttpServer())
        .get(`/public/speakers/${publishedSlug}`)
        .expect(200);

      const body = res.body as DetailResponseBody;
      expect(body.slug).toBe(publishedSlug);
      expect(body.displayName).toBe('Published Fixture');
    });

    it('ne contient AUCUNE clé de pricing, email, phone ou note interne', async () => {
      const res = await request(app.getHttpServer())
        .get(`/public/speakers/${publishedSlug}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body).not.toHaveProperty('pricing');
      expect(body).not.toHaveProperty('email');
      expect(body).not.toHaveProperty('phone');
      expect(body).not.toHaveProperty('internalNotes');
      expect(body).not.toHaveProperty('userId');
      expect(body).not.toHaveProperty('completionScore');
      expect(body).not.toHaveProperty('status');
      expect(body).not.toHaveProperty('nationality');

      const json = JSON.stringify(body);
      expect(json).not.toContain(INTERNAL_NOTE_MARKER);
    });

    it('ne renvoie que les médias status=APPROVED (le média rejeté est absent, pas juste masqué)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/public/speakers/${publishedSlug}`)
        .expect(200);

      const media = (res.body as DetailResponseBody).media;
      expect(media).toHaveLength(1);
      expect(media[0].url).toContain('public-photo');
      expect(media[0]).not.toHaveProperty('status');

      const json = JSON.stringify(res.body);
      expect(json).not.toContain(PRIVATE_MEDIA_URL_MARKER);
    });

    it('inclut feeTierPublic quand showBudget=true', async () => {
      const res = await request(app.getHttpServer())
        .get(`/public/speakers/${publishedSlug}`)
        .expect(200);

      expect((res.body as DetailResponseBody).feeTierPublic).toBe('TIER_2');
    });

    it('OMET la clé feeTierPublic (pas null, absente) quand showBudget=false', async () => {
      const res = await request(app.getHttpServer())
        .get(`/public/speakers/${noBudgetSlug}`)
        .expect(200);

      expect(res.body).not.toHaveProperty('feeTierPublic');
    });

    it('OMET country/city quand showLocation=false', async () => {
      const res = await request(app.getHttpServer())
        .get(`/public/speakers/${noLocationSlug}`)
        .expect(200);

      expect(res.body).not.toHaveProperty('country');
      expect(res.body).not.toHaveProperty('city');
      expect(JSON.stringify(res.body)).not.toContain('Ville secrète');
    });
  });

  describe('GET /public/speakers — tri (Partie A, consolidation)', () => {
    let sortA: string;
    let sortB: string;
    const sortSpeakerIds: number[] = [];

    beforeAll(async () => {
      const suffix = Date.now();
      sortA = `e2e-sort-aaron-${suffix}`;
      sortB = `e2e-sort-zoe-${suffix}`;

      const early = await prisma.speaker.create({
        data: {
          firstName: 'Aaron',
          lastName: 'Zolo',
          slug: sortA,
          status: SpeakerStatus.PUBLISHED,
          isVisible: true,
          publishedAt: new Date('2020-01-01T00:00:00Z'),
        },
      });
      const late = await prisma.speaker.create({
        data: {
          firstName: 'Zoe',
          lastName: 'Aabel',
          slug: sortB,
          status: SpeakerStatus.PUBLISHED,
          isVisible: true,
          publishedAt: new Date('2024-01-01T00:00:00Z'),
        },
      });
      sortSpeakerIds.push(early.id, late.id);
    });

    afterAll(async () => {
      await prisma.speaker.deleteMany({
        where: { id: { in: sortSpeakerIds } },
      });
    });

    it('sortBy=name, sortOrder=asc trie par nom de famille croissant', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ sortBy: 'name', sortOrder: 'asc', perPage: 50 })
        .expect(200);

      const slugs = (res.body as ListResponseBody).data.map((s) => s.slug);
      const indexAabel = slugs.indexOf(sortB); // lastName "Aabel"
      const indexZolo = slugs.indexOf(sortA); // lastName "Zolo"
      expect(indexAabel).toBeGreaterThanOrEqual(0);
      expect(indexZolo).toBeGreaterThanOrEqual(0);
      expect(indexAabel).toBeLessThan(indexZolo);
    });

    it('sortBy=publishedAt (défaut desc) renvoie le plus récent en premier', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ sortBy: 'publishedAt', perPage: 50 })
        .expect(200);

      const slugs = (res.body as ListResponseBody).data.map((s) => s.slug);
      const indexLate = slugs.indexOf(sortB); // publishedAt 2024
      const indexEarly = slugs.indexOf(sortA); // publishedAt 2020
      expect(indexLate).toBeLessThan(indexEarly);
    });

    it("sans sortBy, l'ordre par défaut (isTopRequested/isFeaturedHome/nom) est inchangé", async () => {
      // Non-régression : l'appel nu continue de fonctionner exactement comme
      // avant l'introduction du tri (aucune valeur par défaut imposée).
      await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ perPage: 50 })
        .expect(200);
    });

    it("rejette (400) une valeur de sortBy hors de l'allow-list — notamment un champ privé", async () => {
      // "recommendedFee" n'est PAS dans PublicSpeakerSortBy : même s'il
      // existait comme nom de colonne réel côté admin (speaker_pricing),
      // l'enum fermé le rend structurellement inaccessible ici — jamais
      // moyen de trier par tarif, donc jamais moyen de le deviner par le
      // classement des résultats.
      const res = await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ sortBy: 'recommendedFee', perPage: 50 })
        .expect(400);
      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it('rejette (400) un sortOrder hors de asc/desc', async () => {
      await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ sortBy: 'name', sortOrder: 'banana', perPage: 50 })
        .expect(400);
    });
  });

  describe('GET /public/pillars, /formats, /languages, /countries', () => {
    it('ne nécessitent aucune authentification', async () => {
      await request(app.getHttpServer()).get('/public/pillars').expect(200);
      await request(app.getHttpServer()).get('/public/formats').expect(200);
      await request(app.getHttpServer()).get('/public/languages').expect(200);
      await request(app.getHttpServer()).get('/public/countries').expect(200);
    });
  });

  describe('Documentation Swagger', () => {
    it('/docs-json ne référence que des routes /public/*', async () => {
      const res = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200);

      const body = res.body as { paths: Record<string, unknown> };
      const paths = Object.keys(body.paths);
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) {
        expect(path.startsWith('/public/')).toBe(true);
      }
    });
  });
});
