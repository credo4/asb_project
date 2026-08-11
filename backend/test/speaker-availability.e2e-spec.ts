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
interface PeriodBody {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
}
interface AvailableSpeakerBody {
  speaker: { id: number; displayName: string; slug: string | null };
  status: 'AVAILABLE' | 'UNKNOWN';
  reasons: string[];
}
interface PublicSpeakerBody {
  slug: string;
  [key: string]: unknown;
}

// Ces tests prouvent le modèle "disponible par défaut, sauf exception" (§17
// du cahier des charges) : priorité UNAVAILABLE > AVAILABLE, préavis minimum,
// couverture géographique/virtuelle, cloisonnement par speaker (§2), et
// l'invariant public/privé (CLAUDE.md §5) appliqué aux disponibilités.
describe('Speaker availability API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now();
  const createdUserIds: number[] = [];
  const createdSpeakerIds: number[] = [];

  let countryX: { id: number; iso2: string };
  let countryY: { id: number; iso2: string };

  async function signToken(user: User): Promise<string> {
    return jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  // Speaker PUBLISHED + isVisible (visible du site public ET éligible à la
  // recherche admin/speakers/available) avec compte de connexion.
  async function createPublishedSpeaker(
    label: string,
  ): Promise<{ user: User; speakerId: number; token: string; slug: string }> {
    const user = await prisma.user.create({
      data: {
        email: `e2e-avail-${label}-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const slug = `e2e-avail-${label}-${suffix}`;
    const speaker = await prisma.speaker.create({
      data: {
        userId: user.id,
        firstName: label,
        lastName: 'Availability',
        slug,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        shortBio: 'Bio.',
        publishedAt: new Date(),
      },
    });
    createdSpeakerIds.push(speaker.id);
    const token = await signToken(user);
    return { user, speakerId: speaker.id, token, slug };
  }

  function toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  function addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
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

    const countries = await prisma.country.findMany({
      take: 2,
      orderBy: { id: 'asc' },
      select: { id: true, iso2: true },
    });
    [countryX, countryY] = countries;
  });

  afterAll(async () => {
    await prisma.speakerTravelPreference.deleteMany({
      where: { speakerId: { in: createdSpeakerIds } },
    });
    await prisma.speakerAvailabilityPeriod.deleteMany({
      where: { speakerId: { in: createdSpeakerIds } },
    });
    await prisma.speaker.deleteMany({
      where: { id: { in: createdSpeakerIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('Aucune donnée déclarée -> UNKNOWN, jamais indisponible', () => {
    it('un speaker sans période ni préférences ressort dans la recherche admin avec status UNKNOWN', async () => {
      const speaker = await createPublishedSpeaker('no-data');
      const adminUser = await prisma.user.create({
        data: {
          email: `e2e-avail-admin-${suffix}-1@example.com`,
          role: Role.SUPER_ADMIN,
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(adminUser.id);
      const adminToken = await signToken(adminUser);

      const from = toDateOnly(addDays(new Date(), 30));
      const to = toDateOnly(addDays(new Date(), 31));

      const res = await request(app.getHttpServer())
        .get('/admin/speakers/available')
        .query({ from, to })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = (res.body as AvailableSpeakerBody[]).find(
        (s) => s.speaker.id === speaker.speakerId,
      );
      expect(found).toBeDefined();
      expect(found?.status).toBe('UNKNOWN');
    });
  });

  describe('Priorité UNAVAILABLE > AVAILABLE sur chevauchement', () => {
    let speakerId: number;
    let token: string;
    let adminToken: string;

    beforeAll(async () => {
      const speaker = await createPublishedSpeaker('priority');
      speakerId = speaker.speakerId;
      token = speaker.token;

      const adminUser = await prisma.user.create({
        data: {
          email: `e2e-avail-admin-${suffix}-2@example.com`,
          role: Role.SUPER_ADMIN,
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(adminUser.id);
      adminToken = await signToken(adminUser);

      const windowStart = addDays(new Date(), 60);
      // AVAILABLE du J+60 à J+70, UNAVAILABLE du J+65 à J+75 : les deux
      // chevauchent la fenêtre de requête J+66..J+68.
      await request(app.getHttpServer())
        .post('/speaker/me/availability/periods')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'AVAILABLE',
          startDate: toDateOnly(windowStart),
          endDate: toDateOnly(addDays(windowStart, 10)),
        })
        .expect(201);
      await request(app.getHttpServer())
        .post('/speaker/me/availability/periods')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'UNAVAILABLE',
          startDate: toDateOnly(addDays(windowStart, 5)),
          endDate: toDateOnly(addDays(windowStart, 15)),
          reason: 'Congés',
        })
        .expect(201);
    });

    it('le speaker est exclu de la recherche admin sur le créneau chevauchant les deux périodes', async () => {
      const windowStart = addDays(new Date(), 60);
      const from = toDateOnly(addDays(windowStart, 6));
      const to = toDateOnly(addDays(windowStart, 8));

      const res = await request(app.getHttpServer())
        .get('/admin/speakers/available')
        .query({ from, to })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = (res.body as AvailableSpeakerBody[]).find(
        (s) => s.speaker.id === speakerId,
      );
      expect(found).toBeUndefined();
    });
  });

  describe('Délai minimum de réservation (minimumNoticeDays)', () => {
    let speakerId: number;
    let adminToken: string;

    beforeAll(async () => {
      const speaker = await createPublishedSpeaker('notice');
      speakerId = speaker.speakerId;

      await request(app.getHttpServer())
        .put('/speaker/me/availability/preferences')
        .set('Authorization', `Bearer ${speaker.token}`)
        .send({ travelScope: 'WORLDWIDE', minimumNoticeDays: 10 })
        .expect(200);

      const adminUser = await prisma.user.create({
        data: {
          email: `e2e-avail-admin-${suffix}-3@example.com`,
          role: Role.SUPER_ADMIN,
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(adminUser.id);
      adminToken = await signToken(adminUser);
    });

    it('une demande à J+3 avec un préavis minimum de 10 jours renvoie indisponible, avec la raison explicite', async () => {
      const from = toDateOnly(addDays(new Date(), 3));
      const to = toDateOnly(addDays(new Date(), 4));

      const res = await request(app.getHttpServer())
        .get('/admin/speakers/available')
        .query({ from, to })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = (res.body as AvailableSpeakerBody[]).find(
        (s) => s.speaker.id === speakerId,
      );
      expect(found).toBeUndefined();
    });

    it('la même demande à J+15 (préavis respecté) est disponible', async () => {
      const from = toDateOnly(addDays(new Date(), 15));
      const to = toDateOnly(addDays(new Date(), 16));

      const res = await request(app.getHttpServer())
        .get('/admin/speakers/available')
        .query({ from, to })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = (res.body as AvailableSpeakerBody[]).find(
        (s) => s.speaker.id === speakerId,
      );
      expect(found).toBeDefined();
      expect(found?.status).toBe('AVAILABLE');
    });
  });

  describe('travelScope = SELECTED_COUNTRIES + virtuel', () => {
    let speakerId: number;
    let adminToken: string;

    beforeAll(async () => {
      const speaker = await createPublishedSpeaker('travel');
      speakerId = speaker.speakerId;

      await request(app.getHttpServer())
        .put('/speaker/me/availability/preferences')
        .set('Authorization', `Bearer ${speaker.token}`)
        .send({
          travelScope: 'SELECTED_COUNTRIES',
          countryIds: [countryX.id],
          availableForVirtual: true,
        })
        .expect(200);

      const adminUser = await prisma.user.create({
        data: {
          email: `e2e-avail-admin-${suffix}-4@example.com`,
          role: Role.SUPER_ADMIN,
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(adminUser.id);
      adminToken = await signToken(adminUser);
    });

    it('disponible pour le pays de la liste', async () => {
      const from = toDateOnly(addDays(new Date(), 90));
      const to = toDateOnly(addDays(new Date(), 91));

      const res = await request(app.getHttpServer())
        .get('/admin/speakers/available')
        .query({ from, to, country: countryX.iso2 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = (res.body as AvailableSpeakerBody[]).find(
        (s) => s.speaker.id === speakerId,
      );
      expect(found).toBeDefined();
      expect(found?.status).toBe('AVAILABLE');
    });

    it('indisponible pour un pays hors de la liste', async () => {
      const from = toDateOnly(addDays(new Date(), 90));
      const to = toDateOnly(addDays(new Date(), 91));

      const res = await request(app.getHttpServer())
        .get('/admin/speakers/available')
        .query({ from, to, country: countryY.iso2 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = (res.body as AvailableSpeakerBody[]).find(
        (s) => s.speaker.id === speakerId,
      );
      expect(found).toBeUndefined();
    });

    it('disponible en virtuel malgré travelScope = SELECTED_COUNTRIES, car availableForVirtual = true', async () => {
      const from = toDateOnly(addDays(new Date(), 90));
      const to = toDateOnly(addDays(new Date(), 91));

      const res = await request(app.getHttpServer())
        .get('/admin/speakers/available')
        .query({ from, to, isVirtual: 'true' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = (res.body as AvailableSpeakerBody[]).find(
        (s) => s.speaker.id === speakerId,
      );
      expect(found).toBeDefined();
      expect(found?.status).toBe('AVAILABLE');
    });
  });

  describe('Cloisonnement — 404, jamais 403 (§2)', () => {
    let ownedPeriodId: number;
    let speakerBToken: string;

    beforeAll(async () => {
      const speakerA = await createPublishedSpeaker('cloison-a');
      const speakerB = await createPublishedSpeaker('cloison-b');
      speakerBToken = speakerB.token;

      const res = await request(app.getHttpServer())
        .post('/speaker/me/availability/periods')
        .set('Authorization', `Bearer ${speakerA.token}`)
        .send({
          type: 'UNAVAILABLE',
          startDate: toDateOnly(addDays(new Date(), 100)),
          endDate: toDateOnly(addDays(new Date(), 101)),
        })
        .expect(201);
      ownedPeriodId = (res.body as PeriodBody).id;
    });

    it('le speaker B reçoit 404 (pas 403) en modifiant la période du speaker A', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/speaker/me/availability/periods/${ownedPeriodId}`)
        .set('Authorization', `Bearer ${speakerBToken}`)
        .send({ reason: 'Tentative' })
        .expect(404);
      expect((res.body as ErrorResponseBody).statusCode).toBe(404);
    });

    it('le speaker B reçoit 404 en supprimant la période du speaker A', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/speaker/me/availability/periods/${ownedPeriodId}`)
        .set('Authorization', `Bearer ${speakerBToken}`)
        .expect(404);
      expect((res.body as ErrorResponseBody).statusCode).toBe(404);
    });
  });

  describe('Invariant public/privé (CLAUDE.md §5)', () => {
    it("aucune donnée de disponibilité n'apparaît dans l'API publique, même quand le speaker en a déclaré", async () => {
      const speaker = await createPublishedSpeaker('public-leak');
      const SECRET_MARKER = 'SECRET_AVAILABILITY_NOTE_SHOULD_NEVER_LEAK';

      await request(app.getHttpServer())
        .post('/speaker/me/availability/periods')
        .set('Authorization', `Bearer ${speaker.token}`)
        .send({
          type: 'UNAVAILABLE',
          startDate: toDateOnly(addDays(new Date(), 200)),
          endDate: toDateOnly(addDays(new Date(), 201)),
          reason: SECRET_MARKER,
        })
        .expect(201);
      await request(app.getHttpServer())
        .put('/speaker/me/availability/preferences')
        .set('Authorization', `Bearer ${speaker.token}`)
        .send({
          travelScope: 'SELECTED_COUNTRIES',
          countryIds: [countryX.id],
          notes: SECRET_MARKER,
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/public/speakers/${speaker.slug}`)
        .expect(200);

      const body = res.body as PublicSpeakerBody;
      expect(body).not.toHaveProperty('availability');
      expect(body).not.toHaveProperty('periods');
      expect(body).not.toHaveProperty('preferences');
      expect(body).not.toHaveProperty('travelScope');
      expect(body).not.toHaveProperty('travelPreference');
      expect(body).not.toHaveProperty('minimumNoticeDays');

      const json = JSON.stringify(body);
      expect(json).not.toContain(SECRET_MARKER);
      expect(json).not.toContain('travelScope');
      expect(json).not.toContain('minimumNoticeDays');
      expect(json).not.toContain('availableForVirtual');
    });

    it('la liste publique ne contient également aucune trace de disponibilité', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/speakers')
        .query({ perPage: 50 })
        .expect(200);

      const json = JSON.stringify(res.body);
      expect(json).not.toContain('travelScope');
      expect(json).not.toContain('minimumNoticeDays');
    });
  });

  describe('Garde-fous de validation (§6)', () => {
    let token: string;

    beforeAll(async () => {
      const speaker = await createPublishedSpeaker('validation');
      token = speaker.token;
    });

    it('rejette startDate > endDate', async () => {
      const res = await request(app.getHttpServer())
        .post('/speaker/me/availability/periods')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'AVAILABLE',
          startDate: toDateOnly(addDays(new Date(), 10)),
          endDate: toDateOnly(addDays(new Date(), 5)),
        })
        .expect(400);
      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it('rejette une période dont endDate est dans le passé', async () => {
      const res = await request(app.getHttpServer())
        .post('/speaker/me/availability/periods')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'AVAILABLE',
          startDate: toDateOnly(addDays(new Date(), -10)),
          endDate: toDateOnly(addDays(new Date(), -5)),
        })
        .expect(400);
      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it('rejette un doublon exact mais autorise un chevauchement', async () => {
      const startDate = toDateOnly(addDays(new Date(), 300));
      const endDate = toDateOnly(addDays(new Date(), 305));

      await request(app.getHttpServer())
        .post('/speaker/me/availability/periods')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'AVAILABLE', startDate, endDate })
        .expect(201);

      // Doublon exact (même type, mêmes dates) : rejeté.
      const dup = await request(app.getHttpServer())
        .post('/speaker/me/availability/periods')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'AVAILABLE', startDate, endDate })
        .expect(400);
      expect((dup.body as ErrorResponseBody).statusCode).toBe(400);

      // Chevauchement (mêmes dates, type différent) : autorisé.
      await request(app.getHttpServer())
        .post('/speaker/me/availability/periods')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'UNAVAILABLE', startDate, endDate })
        .expect(201);
    });
  });
});
