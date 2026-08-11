import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ServiceType, SpeakerStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { configureApp } from '../src/app.config';

interface AckResponseBody {
  reference: string;
  message: string;
}
interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
}

// Ces tests couvrent le §3 (validation conditionnelle par serviceType), le
// §4 (référence unique + SLA en jours ouvrés), le §5 (anti-abus : honeypot,
// gdprConsent) et le §6 (un échec d'envoi d'email ne doit jamais faire
// échouer l'enregistrement) du prompt "ingestion des formulaires publics".
describe('Public booking requests API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mailService: {
    sendBookingRequestTeamNotification: jest.Mock;
    sendBookingRequestAcknowledgment: jest.Mock;
  };

  const createdReferences: string[] = [];

  const validConference = () => ({
    serviceType: ServiceType.CONFERENCE,
    fullName: 'Jane Client',
    organization: 'Acme Corp',
    workEmail: 'jane.client@example.com',
    eventName: 'Annual Leadership Summit',
    eventDate: '2027-03-15',
    eventLocation: 'Dakar, Senegal',
    eventFormat: 'In-Person',
    audienceSize: '200-500',
    primaryTopics: 'Leadership africaine',
    goals: 'Inspirer les cadres dirigeants',
    gdprConsent: true,
  });

  beforeAll(async () => {
    mailService = {
      sendBookingRequestTeamNotification: jest
        .fn()
        .mockResolvedValue(undefined),
      sendBookingRequestAcknowledgment: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailService)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mailService.sendBookingRequestTeamNotification.mockResolvedValue(undefined);
    mailService.sendBookingRequestAcknowledgment.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await prisma.bookingRequest.deleteMany({
      where: { reference: { in: createdReferences } },
    });
    await app.close();
  });

  describe('Validation conditionnelle par serviceType', () => {
    it('rejette une CONFERENCE sans eventName (champ requis pour ce groupe de services)', async () => {
      const payload = validConference() as Record<string, unknown>;
      delete payload.eventName;

      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send(payload)
        .expect(400);

      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it("n'exige pas eventName/eventDate pour un ONE_TO_ONE (pas de champs d'événement)", async () => {
      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send({
          serviceType: ServiceType.ONE_TO_ONE,
          fullName: 'John Prospect',
          organization: 'Prospect Inc',
          jobTitle: 'CEO',
          workEmail: 'john.prospect@example.com',
          websiteOrLinkedin: 'https://linkedin.com/in/john-prospect',
          visitPurpose: 'PROSPECTIVE_CLIENT',
          keyQuestions: 'Quelles sont vos disponibilités en mai ?',
          preferredTime: 'Après-midi (UTC)',
          gdprConsent: true,
        })
        .expect(201);

      const body = res.body as AckResponseBody;
      expect(body.reference).toMatch(/^ASB-\d{4}-\d{6}$/);
      createdReferences.push(body.reference);
    });

    it('rejette un ONE_TO_ONE sans jobTitle/websiteOrLinkedin/visitPurpose (requis pour ce service)', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send({
          serviceType: ServiceType.ONE_TO_ONE,
          fullName: 'John Prospect',
          organization: 'Prospect Inc',
          workEmail: 'john.prospect@example.com',
          gdprConsent: true,
        })
        .expect(400);

      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it("rejette un eventFormat qui n'est pas dans la liste autorisée pour le service (WEBINAR n'accepte que 'Virtual')", async () => {
      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send({
          serviceType: ServiceType.WEBINAR,
          fullName: 'Jane Client',
          organization: 'Acme Corp',
          workEmail: 'jane.client@example.com',
          eventName: 'Webinar Q3',
          eventDate: '2027-03-15',
          eventLocation: 'Online',
          eventFormat: 'In-Person', // invalide pour WEBINAR
          audienceSize: '50-100',
          primaryTopics: 'Sujet',
          goals: 'But',
          gdprConsent: true,
        })
        .expect(400);

      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it('rejette gdprConsent=false', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send({ ...validConference(), gdprConsent: false })
        .expect(400);

      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });
  });

  describe('Anti-abus', () => {
    it("honeypot rempli : renvoie un succès normal mais n'enregistre rien", async () => {
      const countBefore = await prisma.bookingRequest.count();

      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send({ ...validConference(), website2: 'https://spam.example.com' })
        .expect(201);

      const body = res.body as AckResponseBody;
      expect(body.reference).toMatch(/^ASB-\d{4}-\d{6}$/);

      const countAfter = await prisma.bookingRequest.count();
      expect(countAfter).toBe(countBefore);
      expect(
        mailService.sendBookingRequestAcknowledgment,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Création valide : référence, SLA, requestedSpeakerId', () => {
    it('crée une demande CONFERENCE avec une référence unique et un responseDueAt à +2 jours ouvrés', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send(validConference())
        .expect(201);

      const body = res.body as AckResponseBody;
      expect(body.reference).toMatch(/^ASB-\d{4}-\d{6}$/);
      createdReferences.push(body.reference);

      const row = await prisma.bookingRequest.findUniqueOrThrow({
        where: { reference: body.reference },
      });
      expect(row.status).toBe('NEW');
      expect(row.source).toBe('PUBLIC_FORM');
      expect(row.responseDueAt).not.toBeNull();
      // +2 jours ouvrés : entre 2 et 4 jours calendaires selon le jour de la semaine.
      // Tolérance de quelques ms : responseDueAt est calculé depuis `new Date()`
      // legèrement AVANT que createdAt ne soit persisté par MySQL, donc le
      // diff mesuré peut être infinitésimalement inférieur à 2 jours pile.
      const diffDays =
        (row.responseDueAt!.getTime() - row.createdAt.getTime()) /
        (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThanOrEqual(2 - 0.001);
      expect(diffDays).toBeLessThanOrEqual(4);
    });

    it('génère deux références distinctes pour deux soumissions successives', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send(validConference())
        .expect(201);
      const res2 = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send(validConference())
        .expect(201);

      const ref1 = (res1.body as AckResponseBody).reference;
      const ref2 = (res2.body as AckResponseBody).reference;
      createdReferences.push(ref1, ref2);

      expect(ref1).not.toBe(ref2);
    });

    it('ignore silencieusement un requestedSpeakerId qui ne correspond à aucun speaker publié', async () => {
      const draftSpeaker = await prisma.speaker.create({
        data: {
          firstName: 'Draft',
          lastName: 'NotPublished',
          status: SpeakerStatus.DRAFT,
          isVisible: false,
        },
      });

      try {
        const res = await request(app.getHttpServer())
          .post('/public/booking-requests')
          .send({
            ...validConference(),
            requestedSpeakerId: draftSpeaker.id,
          })
          .expect(201);

        const reference = (res.body as AckResponseBody).reference;
        createdReferences.push(reference);

        const row = await prisma.bookingRequest.findUniqueOrThrow({
          where: { reference },
        });
        expect(row.requestedSpeakerId).toBeNull();
      } finally {
        await prisma.speaker.delete({ where: { id: draftSpeaker.id } });
      }
    });
  });

  describe("Isolation email : un échec d'envoi ne doit jamais faire échouer l'enregistrement", () => {
    it("persiste la demande même si les deux envois d'email échouent", async () => {
      mailService.sendBookingRequestTeamNotification.mockRejectedValueOnce(
        new Error('SMTP down'),
      );
      mailService.sendBookingRequestAcknowledgment.mockRejectedValueOnce(
        new Error('SMTP down'),
      );

      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send(validConference())
        .expect(201);

      const reference = (res.body as AckResponseBody).reference;
      createdReferences.push(reference);

      const row = await prisma.bookingRequest.findUnique({
        where: { reference },
      });
      expect(row).not.toBeNull();
      expect(
        mailService.sendBookingRequestTeamNotification,
      ).toHaveBeenCalledTimes(1);
      expect(
        mailService.sendBookingRequestAcknowledgment,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
