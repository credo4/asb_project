import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  ApplicationStatus,
  BookingStatus,
  Role,
  ServiceType,
  User,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/app.config';

interface ErrorResponseBody {
  statusCode: number;
}
interface EmailDeliveryListBody {
  data: { id: number; status: string; template: string }[];
  meta: { total: number };
}
interface BookingRequestDetailBody {
  id: number;
  emailDeliveries: { id: number; template: string; status: string }[];
}
interface AckResponseBody {
  reference: string;
}
interface ConversionResultBody {
  user: { id: number; email: string };
  speaker: { id: number };
  invitationSent: boolean;
}

// Couvre le prompt "consolidation avant la suite de la Phase 3", Partie E :
// journal d'envoi des emails. Les identifiants SMTP de dev (.env,
// MAIL_HOST=smtp.ethereal.email / MAIL_USER=changeme) sont volontairement
// invalides — chaque envoi RÉEL déclenché par ces tests échoue donc pour de
// vrai, ce qui permet de vérifier le chemin FAILED sans mock.
describe('Journal des emails — email_deliveries (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now();
  const createdUserIds: number[] = [];
  const createdDeliveryIds: number[] = [];
  const createdBookingReferences: string[] = [];
  const createdApplicationIds: number[] = [];
  const createdSpeakerIds: number[] = [];
  const createdOrganizationIds: number[] = [];

  let adminToken: string;
  let speakerToken: string;

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
        email: `e2e-emaildelivery-admin-${suffix}@example.com`,
        role: Role.ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signToken(adminUser);

    const speakerUser = await prisma.user.create({
      data: {
        email: `e2e-emaildelivery-speaker-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(speakerUser.id);
    speakerToken = await signToken(speakerUser);
  });

  afterAll(async () => {
    await prisma.emailDelivery.deleteMany({
      where: { id: { in: createdDeliveryIds } },
    });
    await prisma.bookingRequest.deleteMany({
      where: { reference: { in: createdBookingReferences } },
    });
    await prisma.rosterApplication.deleteMany({
      where: { id: { in: createdApplicationIds } },
    });
    // Speaker.userId est ON DELETE SET NULL (pas Cascade) — supprimé
    // explicitement AVANT le user, sinon il survivrait orphelin.
    await prisma.speaker.deleteMany({
      where: { id: { in: createdSpeakerIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.organization.deleteMany({
      where: { id: { in: createdOrganizationIds } },
    });
    await app.close();
  });

  describe('GET /admin/email-deliveries', () => {
    it('liste paginée, filtrable par statut, réservée ADMIN/SUPER_ADMIN', async () => {
      const sent = await prisma.emailDelivery.create({
        data: {
          template: `test-sent-${suffix}`,
          recipient: 'sent@example.com',
          subject: 'Sujet test',
          status: 'SENT',
          sentAt: new Date(),
        },
      });
      const failed = await prisma.emailDelivery.create({
        data: {
          template: `test-failed-${suffix}`,
          recipient: 'failed@example.com',
          subject: 'Sujet test',
          status: 'FAILED',
          errorMessage: 'SMTP down (fixture)',
        },
      });
      createdDeliveryIds.push(sent.id, failed.id);

      const res = await request(app.getHttpServer())
        .get('/admin/email-deliveries')
        .query({ status: 'FAILED', perPage: 50 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as EmailDeliveryListBody;
      expect(body.data.every((d) => d.status === 'FAILED')).toBe(true);
      expect(body.data.map((d) => d.id)).toContain(failed.id);
      expect(body.data.map((d) => d.id)).not.toContain(sent.id);
    });

    it('refuse un token SPEAKER', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/email-deliveries')
        .set('Authorization', `Bearer ${speakerToken}`)
        .expect(403);
      expect((res.body as ErrorResponseBody).statusCode).toBe(403);
    });

    it('filtre par plage de dates (dateFrom/dateTo sur attemptedAt)', async () => {
      const future = new Date(Date.now() + 3600_000).toISOString();
      const res = await request(app.getHttpServer())
        .get('/admin/email-deliveries')
        .query({ dateFrom: future })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Rien ne peut avoir été tenté dans le futur.
      const body = res.body as EmailDeliveryListBody;
      expect(body.meta.total).toBe(0);
    });
  });

  describe("Comportement inchangé côté appelant — un échec d'envoi ne casse jamais l'opération", () => {
    it(
      'une soumission publique réussit (201) même si les emails déclenchés échouent réellement ' +
        '(identifiants SMTP de dev invalides) — et la vue détaillée admin montre le statut FAILED',
      async () => {
        // Tentative RÉELLE de connexion SMTP (pas de mock, voir en-tête de
        // fichier) : la négociation TLS + le rejet d'authentification par
        // smtp.ethereal.email peuvent dépasser le timeout par défaut de
        // Jest (5000 ms), surtout à froid. Timeout explicite ci-dessous
        // (3e argument de `it`), et attente plus large avant de lire le
        // journal (voir plus bas).
        const res = await request(app.getHttpServer())
          .post('/public/booking-requests')
          .send({
            serviceType: ServiceType.CONFERENCE,
            fullName: '[E2E] Email Delivery Fixture',
            organization: '[E2E] Email Delivery Org',
            workEmail: `e2e-emaildelivery-${suffix}@example.com`,
            eventName: '[E2E] Event',
            eventDate: '2027-06-01',
            eventLocation: 'Dakar',
            eventFormat: 'In-Person',
            audienceSize: '50-100',
            primaryTopics: 'x',
            goals: 'x',
            gdprConsent: true,
          })
          .expect(201);

        const reference = (res.body as AckResponseBody).reference;
        createdBookingReferences.push(reference);
        const bookingRequest = await prisma.bookingRequest.findUniqueOrThrow({
          where: { reference },
        });

        // Laisse le temps aux tentatives d'envoi (best-effort, hors requête
        // HTTP) de se terminer avant d'interroger le journal — une vraie
        // négociation SMTP (voir commentaire ci-dessus) peut prendre
        // plusieurs secondes, 500 ms était trop court et rendait ce test
        // intermittent.
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const detail = await request(app.getHttpServer())
          .get(`/admin/booking-requests/${bookingRequest.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const body = detail.body as BookingRequestDetailBody;
        expect(body.emailDeliveries.length).toBeGreaterThan(0);
        expect(body.emailDeliveries.some((d) => d.status === 'FAILED')).toBe(
          true,
        );

        // Vérifie aussi directement en base que le rattachement
        // (relatedEntityType/relatedEntityId) fonctionne.
        const rows = await prisma.emailDelivery.findMany({
          where: {
            relatedEntityType: 'BookingRequest',
            relatedEntityId: bookingRequest.id,
          },
        });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.status === 'FAILED')).toBe(true);
        expect(rows.every((r) => r.errorMessage)).toBeTruthy();
      },
      15000,
    );

    it(
      'conversion de candidature (§4.2) : la conversion RÉUSSIT (compte + ' +
        "fiche + token créés) même si l'envoi RÉEL de l'invitation échoue " +
        '— aucun envoi ne se trouve DANS la transaction Prisma',
      async () => {
        const application = await prisma.rosterApplication.create({
          data: {
            reference: `APP-E2E-EMAILDELIVERY-${suffix}`,
            fullName: '[E2E] Email Delivery Candidate',
            organization: '[E2E] Email Delivery Org',
            workEmail: `e2e-emaildelivery-conversion-${suffix}@example.com`,
            gdprConsent: true,
            status: ApplicationStatus.APPROVED,
          },
        });
        createdApplicationIds.push(application.id);

        const res = await request(app.getHttpServer())
          .post(`/admin/roster-applications/${application.id}/convert`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(201);
        const body = res.body as ConversionResultBody;
        createdUserIds.push(body.user.id);
        createdSpeakerIds.push(body.speaker.id);

        // La négociation SMTP réelle (voir en-tête de fichier) a le temps
        // de se terminer avant la fin de la requête HTTP elle-même :
        // l'envoi se fait maintenant APRÈS le commit, dans le corps de la
        // méthode, avant que la réponse ne parte — pas besoin d'attente
        // supplémentaire ici (contrairement au test booking-requests
        // ci-dessus, qui vérifie un envoi véritablement fire-and-forget).
        expect(body.invitationSent).toBe(false);

        const converted = await prisma.rosterApplication.findUniqueOrThrow({
          where: { id: application.id },
        });
        expect(converted.status).toBe('CONVERTED');
        expect(converted.convertedUserId).toBe(body.user.id);
        expect(converted.convertedSpeakerId).toBe(body.speaker.id);

        const tokenCount = await prisma.invitationToken.count({
          where: { userId: body.user.id },
        });
        expect(tokenCount).toBe(1);

        const rows = await prisma.emailDelivery.findMany({
          where: {
            relatedEntityType: 'RosterApplication',
            relatedEntityId: application.id,
          },
        });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.status === 'FAILED')).toBe(true);
        expect(rows.every((r) => r.errorMessage)).toBeTruthy();
      },
      15000,
    );

    it(
      'envoi de sollicitation de disponibilité (Phase 3d, §5) : réussit ' +
        "quand même si l'envoi RÉEL échoue, journalisé FAILED",
      async () => {
        const speakerUser = await prisma.user.create({
          data: {
            email: `e2e-emaildelivery-availspeaker-${suffix}@example.com`,
            role: Role.SPEAKER,
            status: 'ACTIVE',
          },
        });
        createdUserIds.push(speakerUser.id);
        const speaker = await prisma.speaker.create({
          data: {
            userId: speakerUser.id,
            firstName: 'Avail',
            lastName: 'Speaker',
            slug: `e2e-emaildelivery-availspeaker-${suffix}`,
            status: 'PUBLISHED',
            isVisible: true,
            publishedAt: new Date(),
          },
        });
        createdSpeakerIds.push(speaker.id);

        const bookingRequest = await prisma.bookingRequest.create({
          data: {
            reference: `ASB-EMAILDELIV-3D-${suffix}`,
            serviceType: ServiceType.CONFERENCE,
            fullName: '[E2E] Email Delivery Client',
            workEmail: `e2e-emaildelivery-availclient-${suffix}@example.com`,
          },
        });
        createdBookingReferences.push(bookingRequest.reference);

        await request(app.getHttpServer())
          .post(`/admin/booking-requests/${bookingRequest.id}/speakers`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ speakerId: speaker.id })
          .expect(201);

        const res = await request(app.getHttpServer())
          .post('/admin/availability-requests')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            bookingRequestId: bookingRequest.id,
            speakerId: speaker.id,
            eventType: 'Conference',
            eventDate: '2027-09-15',
            topic: 'Topic',
          })
          .expect(201);
        const availabilityRequestId = (res.body as { id: number }).id;

        const rows = await prisma.emailDelivery.findMany({
          where: {
            relatedEntityType: 'AvailabilityRequest',
            relatedEntityId: availabilityRequestId,
          },
        });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.status === 'FAILED')).toBe(true);
        expect(rows.every((r) => r.errorMessage)).toBeTruthy();
      },
      15000,
    );

    it(
      'création de mission (Phase 3e, §1/§9) : réussit (201) même si ' +
        "l'envoi RÉEL de notification au speaker échoue, journalisé FAILED " +
        "sous relatedEntityType = 'Mission'",
      async () => {
        const speakerUser = await prisma.user.create({
          data: {
            email: `e2e-emaildelivery-missionspeaker-${suffix}@example.com`,
            role: Role.SPEAKER,
            status: 'ACTIVE',
          },
        });
        createdUserIds.push(speakerUser.id);
        const speaker = await prisma.speaker.create({
          data: {
            userId: speakerUser.id,
            firstName: 'Mission',
            lastName: 'Speaker',
            slug: `e2e-emaildelivery-missionspeaker-${suffix}`,
            status: 'PUBLISHED',
            isVisible: true,
            publishedAt: new Date(),
          },
        });
        createdSpeakerIds.push(speaker.id);

        const organization = await prisma.organization.create({
          data: { name: `[E2E] Email Delivery Mission Org ${suffix}` },
        });
        createdOrganizationIds.push(organization.id);

        const bookingRequest = await prisma.bookingRequest.create({
          data: {
            reference: `ASB-EMAILDELIV-MSN-${suffix}`,
            serviceType: ServiceType.CONFERENCE,
            fullName: '[E2E] Email Delivery Mission Client',
            organization: '[E2E] Email Delivery Mission Client Org',
            workEmail: `e2e-emaildelivery-missionclient-${suffix}@example.com`,
            eventDate: new Date('2027-10-01T00:00:00.000Z'),
            primaryTopics: 'Digital transformation',
            organizationId: organization.id,
            status: BookingStatus.CONFIRMED,
          },
        });
        createdBookingReferences.push(bookingRequest.reference);

        await request(app.getHttpServer())
          .post(`/admin/booking-requests/${bookingRequest.id}/speakers`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ speakerId: speaker.id })
          .expect(201);

        const res = await request(app.getHttpServer())
          .post(`/admin/booking-requests/${bookingRequest.id}/missions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ speakerId: speaker.id })
          .expect(201);
        const missionId = (res.body as { id: number }).id;

        const rows = await prisma.emailDelivery.findMany({
          where: {
            relatedEntityType: 'Mission',
            relatedEntityId: missionId,
          },
        });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.status === 'FAILED')).toBe(true);
        expect(rows.every((r) => r.errorMessage)).toBeTruthy();
      },
      15000,
    );
  });
});
