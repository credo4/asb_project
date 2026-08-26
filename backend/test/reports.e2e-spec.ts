import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  MissionStatus,
  Role,
  ServiceType,
  SpeakerStatus,
  User,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/app.config';

// Rapports et statistiques (§14, ligne 5.13, Partie A). Ces tests prouvent :
// l'agrégation elle-même (un speaker/une organisation/une mission fixture
// apparaît bien dans le bon classement, avec les bons chiffres), le
// dédoublonnage des vues (§A1, fenêtre de 30 min), l'accès réservé
// SUPER_ADMIN pour chiffre d'affaires/commission (§A4 — clés ABSENTES, pas
// juste masquées), et l'export CSV (§A6).
//
// La base de dev contient déjà beaucoup d'autres données (autres specs,
// seed de démo) : les assertions ci-dessous cherchent la fixture DANS le
// classement plutôt que de comparer des totaux exacts, sauf quand la
// fenêtre de période (from/to très courte, calée sur `Date.now()`) isole
// suffisamment le test pour affirmer une valeur précise (dédoublonnage).

interface RankingItem {
  id: number;
  label: string;
  count: number;
}
interface ComparedValue {
  current: number;
  previous: number;
}
interface SpeakerRow {
  speakerId: number;
  profileViews: number;
  requestsCount: number;
  missionsCount: number;
  availabilityResponsesTotal: number;
  availabilityAcceptanceRate: number | null;
  realizedRevenue?: number;
}
interface SpeakersReportBody {
  totalProfileViews: ComparedValue;
  totalRequests: ComparedValue;
  totalMissions: ComparedValue;
  acceptanceRate: ComparedValue;
  speakers: SpeakerRow[];
  topClientCountries: RankingItem[];
}
interface CommercialReportBody {
  revenue?: { realized: ComparedValue; forecast: ComparedValue };
  commission?: { realized: ComparedValue; forecast: ComparedValue };
  conversionRate: ComparedValue;
  averageMissionClientAmount: ComparedValue;
  topClientOrganizations: RankingItem[];
  topBookedSpeakers: RankingItem[];
}
interface EditorialReportBody {
  zeroResultSearchesCount: ComparedValue;
  topZeroResultQueries: { query: string | null; count: number }[];
}

describe('Reports API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now();
  const createdUserIds: number[] = [];
  const createdSpeakerIds: number[] = [];
  const createdBookingRequestIds: number[] = [];
  const createdOrganizationIds: number[] = [];
  const createdMissionIds: number[] = [];

  let superAdminToken: string;
  let adminToken: string;
  let speakerToken: string;

  let periodFrom: string;
  let periodTo: string;
  let fixtureSpeakerId: number;
  let fixtureOrganizationId: number;
  let fixtureOrganizationName: string;

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

    const superAdminUser = await prisma.user.create({
      data: {
        email: `e2e-reports-superadmin-${suffix}@example.com`,
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(superAdminUser.id);
    superAdminToken = await signToken(superAdminUser);

    const adminUser = await prisma.user.create({
      data: {
        email: `e2e-reports-admin-${suffix}@example.com`,
        role: Role.ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signToken(adminUser);

    const speakerUser = await prisma.user.create({
      data: {
        email: `e2e-reports-speaker-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(speakerUser.id);
    speakerToken = await signToken(speakerUser);

    // §14.1 — speaker fixture, relié à un format existant (classement
    // "topFormats") pour éviter de dépendre d'une taxonomie créée ici.
    const format = await prisma.format.findFirst();
    const country = await prisma.country.findFirst();

    const speaker = await prisma.speaker.create({
      data: {
        firstName: 'Reports',
        lastName: 'Fixture',
        slug: `e2e-reports-speaker-${suffix}`,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        shortBio: 'Bio.',
        publishedAt: new Date(),
      },
    });
    createdSpeakerIds.push(speaker.id);
    fixtureSpeakerId = speaker.id;

    if (format) {
      await prisma.speakerFormat.create({
        data: { speakerId: speaker.id, formatId: format.id },
      });
    }

    // §14.2/14.1 — organisation cliente, reliée à un pays (classement
    // "topClientCountries").
    fixtureOrganizationName = `[E2E] Reports Org ${suffix}`;
    const organization = await prisma.organization.create({
      data: { name: fixtureOrganizationName, countryId: country?.id },
    });
    createdOrganizationIds.push(organization.id);
    fixtureOrganizationId = organization.id;

    // Fenêtre de période : englobe tout ce que ce bloc va créer, sans
    // dépendre de l'horloge exacte de chaque insertion individuelle.
    const windowStart = new Date(Date.now() - 5_000);

    const bookingRequest = await prisma.bookingRequest.create({
      data: {
        reference: `ASB-E2E-REPORTS-${suffix}`,
        serviceType: ServiceType.CONFERENCE,
        fullName: '[E2E] Reports Client',
        organization: fixtureOrganizationName,
        workEmail: `e2e-reports-client-${suffix}@example.com`,
        organizationId: organization.id,
        status: 'CONFIRMED',
      },
    });
    createdBookingRequestIds.push(bookingRequest.id);

    // §14.1 — "demandes l'ayant cité comme candidat" (booking_request_speakers).
    await prisma.bookingRequestSpeaker.create({
      data: { requestId: bookingRequest.id, speakerId: speaker.id },
    });

    // §14.2 — mission LIVRÉE (chiffre d'affaires RÉALISÉ), montant client
    // connu pour vérifier averageMissionClientAmount/topBookedSpeakers.
    const mission = await prisma.mission.create({
      data: {
        reference: `MSN-E2E-REPORTS-${suffix}`,
        bookingRequestId: bookingRequest.id,
        speakerId: speaker.id,
        organizationId: organization.id,
        serviceType: ServiceType.CONFERENCE,
        eventDate: new Date(),
        topic: 'E2E reports fixture',
        status: MissionStatus.DELIVERED,
        clientAmount: 8000,
        agencyCommission: 1200,
        currency: 'USD',
      },
    });
    createdMissionIds.push(mission.id);

    // §14.1 — sollicitation de disponibilité déjà RÉPONDUE (acceptée), pour
    // availabilityAcceptanceRate/availabilityResponsesTotal.
    await prisma.availabilityRequest.create({
      data: {
        bookingRequestId: bookingRequest.id,
        speakerId: speaker.id,
        respondDueAt: new Date(Date.now() + 86_400_000),
        eventType: 'Conference',
        eventDate: new Date(),
        topic: 'E2E reports fixture',
        status: 'RESPONDED',
        responseStatus: 'AVAILABLE_INTERESTED',
        respondedAt: new Date(),
      },
    });

    periodFrom = windowStart.toISOString();
    periodTo = new Date(Date.now() + 5_000).toISOString();
  });

  afterAll(async () => {
    await prisma.availabilityRequest.deleteMany({
      where: { speakerId: { in: createdSpeakerIds } },
    });
    await prisma.mission.deleteMany({
      where: { id: { in: createdMissionIds } },
    });
    await prisma.bookingRequestSpeaker.deleteMany({
      where: { speakerId: { in: createdSpeakerIds } },
    });
    await prisma.bookingRequest.deleteMany({
      where: { id: { in: createdBookingRequestIds } },
    });
    await prisma.speakerFormat.deleteMany({
      where: { speakerId: { in: createdSpeakerIds } },
    });
    await prisma.analyticsEvent.deleteMany({
      where: { speakerId: { in: createdSpeakerIds } },
    });
    await prisma.speaker.deleteMany({
      where: { id: { in: createdSpeakerIds } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: createdOrganizationIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('§A4 — accès', () => {
    it('rejette un rôle SPEAKER (403)', async () => {
      await request(app.getHttpServer())
        .get('/admin/reports/commercial')
        .set('Authorization', `Bearer ${speakerToken}`)
        .expect(403);
    });

    it('rejette une requête non authentifiée (401)', async () => {
      await request(app.getHttpServer())
        .get('/admin/reports/speakers')
        .expect(401);
    });

    it('un ADMIN ne voit ni `revenue` ni `commission` (clés absentes, pas nulles)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/reports/commercial')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as CommercialReportBody;
      expect(body.revenue).toBeUndefined();
      expect(body.commission).toBeUndefined();
      expect('revenue' in body).toBe(false);
      expect('commission' in body).toBe(false);
    });

    it('un SUPER_ADMIN voit `revenue` et `commission`', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/reports/commercial')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const body = res.body as CommercialReportBody;
      expect(body.revenue).toBeDefined();
      expect(body.commission).toBeDefined();
      expect(body.revenue?.realized.current).toEqual(expect.any(Number));
    });

    it('un ADMIN ne voit pas `realizedRevenue` par speaker, un SUPER_ADMIN si', async () => {
      const asAdmin = await request(app.getHttpServer())
        .get('/admin/reports/speakers')
        .query({ from: periodFrom, to: periodTo })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const bodyAdmin = asAdmin.body as SpeakersReportBody;
      const rowAdmin = bodyAdmin.speakers.find(
        (s) => s.speakerId === fixtureSpeakerId,
      );
      expect(rowAdmin).toBeDefined();
      expect('realizedRevenue' in (rowAdmin as SpeakerRow)).toBe(false);

      const asSuperAdmin = await request(app.getHttpServer())
        .get('/admin/reports/speakers')
        .query({ from: periodFrom, to: periodTo })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const bodySuperAdmin = asSuperAdmin.body as SpeakersReportBody;
      const rowSuperAdmin = bodySuperAdmin.speakers.find(
        (s) => s.speakerId === fixtureSpeakerId,
      );
      expect(rowSuperAdmin?.realizedRevenue).toBe(8000);
    });
  });

  describe('§14.1 — rapport Speakers : agrégation', () => {
    it('retrouve le speaker fixture avec ses compteurs corrects', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/reports/speakers')
        .query({ from: periodFrom, to: periodTo })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = res.body as SpeakersReportBody;
      const row = body.speakers.find((s) => s.speakerId === fixtureSpeakerId);
      expect(row).toBeDefined();
      expect(row?.requestsCount).toBe(1);
      expect(row?.missionsCount).toBe(1);
      expect(row?.availabilityResponsesTotal).toBe(1);
      expect(row?.availabilityAcceptanceRate).toBe(100);
      expect(row?.realizedRevenue).toBe(8000);
    });

    it('les 4 tuiles globales (totalRequests/totalMissions/acceptanceRate) reflètent la fixture', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/reports/speakers')
        .query({ from: periodFrom, to: periodTo })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = res.body as SpeakersReportBody;
      // Fenêtre isolée à cette seule fixture : 1 demande, 1 mission.
      expect(body.totalRequests.current).toBe(1);
      expect(body.totalMissions.current).toBe(1);
      expect(body.acceptanceRate.current).toBe(100);
    });

    it("`topClientCountries` inclut le pays de l'organisation fixture (si rattachée à un pays)", async () => {
      const country = await prisma.organization.findUnique({
        where: { id: fixtureOrganizationId },
        select: { countryId: true },
      });
      if (!country?.countryId) return; // pas de pays en base de dev : rien à vérifier ici
      const res = await request(app.getHttpServer())
        .get('/admin/reports/speakers')
        .query({ from: periodFrom, to: periodTo })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const body = res.body as SpeakersReportBody;
      expect(
        body.topClientCountries.some((r) => r.id === country.countryId),
      ).toBe(true);
    });
  });

  describe('§14.2 — rapport Commercial : agrégation', () => {
    it("inclut l'organisation fixture dans `topClientOrganizations`", async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/reports/commercial')
        .query({ from: periodFrom, to: periodTo })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const body = res.body as CommercialReportBody;
      const org = body.topClientOrganizations.find(
        (r) => r.id === fixtureOrganizationId,
      );
      expect(org).toBeDefined();
      expect(org?.label).toBe(fixtureOrganizationName);
    });

    it('compte la mission fixture dans `topBookedSpeakers` et `averageMissionClientAmount`', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/reports/commercial')
        .query({ from: periodFrom, to: periodTo })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const body = res.body as CommercialReportBody;
      const bySpeaker = body.topBookedSpeakers.find(
        (r) => r.id === fixtureSpeakerId,
      );
      expect(bySpeaker).toBeDefined();
      expect(body.averageMissionClientAmount.current).toBe(8000);
      expect(body.revenue?.realized.current).toBeGreaterThanOrEqual(8000);
      expect(body.commission?.realized.current).toBeGreaterThanOrEqual(1200);
    });

    it('la demande confirmée compte dans le taux de conversion (au moins une mission en est issue)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/reports/commercial')
        .query({ from: periodFrom, to: periodTo })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const body = res.body as CommercialReportBody;
      // Fenêtre isolée à cette seule fixture : 1 demande créée, convertie.
      expect(body.conversionRate.current).toBe(100);
    });
  });

  describe('§A1 — dédoublonnage des vues de profil (fenêtre de 30 min)', () => {
    it('une même empreinte visiteur qui revoit le même profil dans les 30 min compte pour UNE vue', async () => {
      const visitorHash = `e2e-reports-dedup-${suffix}`;
      const now = new Date();
      await prisma.analyticsEvent.createMany({
        data: [
          // Session A : 3 vues du même visiteur en 10 minutes -> 1 vue.
          {
            type: 'PROFILE_VIEW',
            speakerId: fixtureSpeakerId,
            visitorHash,
            isBot: false,
            createdAt: now,
          },
          {
            type: 'PROFILE_VIEW',
            speakerId: fixtureSpeakerId,
            visitorHash,
            isBot: false,
            createdAt: new Date(now.getTime() + 5 * 60_000),
          },
          {
            type: 'PROFILE_VIEW',
            speakerId: fixtureSpeakerId,
            visitorHash,
            isBot: false,
            createdAt: new Date(now.getTime() + 10 * 60_000),
          },
          // 40 minutes plus tard, même visiteur : nouvelle session -> +1 vue.
          {
            type: 'PROFILE_VIEW',
            speakerId: fixtureSpeakerId,
            visitorHash,
            isBot: false,
            createdAt: new Date(now.getTime() + 50 * 60_000),
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/admin/reports/speakers')
        .query({
          from: now.toISOString(),
          to: new Date(now.getTime() + 60 * 60_000).toISOString(),
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = res.body as SpeakersReportBody;
      const row = body.speakers.find((s) => s.speakerId === fixtureSpeakerId);
      expect(row?.profileViews).toBe(2);
      expect(body.totalProfileViews.current).toBe(2);
    });
  });

  describe('§14.3 — rapport Éditorial', () => {
    it('une recherche sans résultat apparaît dans `topZeroResultQueries`', async () => {
      const query = `e2e-reports-zero-${suffix}`;
      const now = new Date();
      await prisma.analyticsEvent.create({
        data: {
          type: 'SEARCH',
          visitorHash: `e2e-reports-search-${suffix}`,
          isBot: false,
          createdAt: now,
          payload: { filters: { q: query }, resultCount: 0 },
        },
      });

      const res = await request(app.getHttpServer())
        .get('/admin/reports/editorial')
        .query({
          from: now.toISOString(),
          to: new Date(now.getTime() + 1_000).toISOString(),
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = res.body as EditorialReportBody;
      expect(body.zeroResultSearchesCount.current).toBe(1);
      expect(body.topZeroResultQueries.some((r) => r.query === query)).toBe(
        true,
      );
    });
  });

  describe('§A6 — export CSV', () => {
    it('renvoie un CSV avec en-têtes appropriés pour la table par défaut du rapport Speakers', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/reports/speakers')
        .query({ from: periodFrom, to: periodTo, format: 'csv' })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text).toContain('speakerId,nom,slug');
      expect(res.text).toContain('revenusRealises');
    });

    it('omet la colonne `revenusRealises` du CSV pour un ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/reports/speakers')
        .query({ from: periodFrom, to: periodTo, format: 'csv' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.text).not.toContain('revenusRealises');
    });

    it('exporte une table spécifique via `table=topClientOrganizations`', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/reports/commercial')
        .query({
          from: periodFrom,
          to: periodTo,
          format: 'csv',
          table: 'topClientOrganizations',
        })
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.text).toContain(fixtureOrganizationName);
    });
  });
});
