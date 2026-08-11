import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  AvailabilityPeriodType,
  BookingStatus,
  Role,
  ServiceType,
  SpeakerStatus,
  User,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { AvailabilityRequestsService } from '../src/modules/availability-requests/availability-requests.service';
import { configureApp } from '../src/app.config';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
}
interface MatchingCandidateBody {
  speaker: { id: number };
  availability: {
    status: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
    reasons: string[];
  };
  criteria: { satisfied: string[]; unsatisfied: string[] };
}
interface MatchingResponseBody {
  candidates: MatchingCandidateBody[];
}
interface BookingRequestSpeakerBody {
  id: number;
  speaker: { id: number };
  status: string;
  displayOrder: number;
  proposedToClientAt: string | null;
}
interface AvailabilityRequestAdminBody {
  id: number;
  status: string;
  bookingRequestId: number;
  speakerId: number;
}
interface OpportunityBody {
  id: number;
  status: string;
  responseStatus: string | null;
  [key: string]: unknown;
}

// Couvre le prompt Phase 3, étape 3d (§6) : matching assisté (réutilise
// checkAvailability, aucun scoring), sélection de candidats, envoi de
// sollicitations (frontière admin<->speaker, §3.1 — LE test le plus
// important de cette étape), cycle de vie complet d'une réponse, et le
// rappel explicite qu'une réponse de disponibilité n'engage rien (§3.5).
describe('Matching & availability requests (Phase 3d) API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let availabilityRequestsService: AvailabilityRequestsService;
  let mailService: {
    sendAvailabilityRequestNotification: jest.Mock;
    sendAvailabilityResponseNotification: jest.Mock;
    sendAvailabilityRequestExpired: jest.Mock;
    [key: string]: jest.Mock;
  };

  const suffix = Date.now();
  let refCounter = 0;
  const createdUserIds: number[] = [];
  const createdSpeakerIds: number[] = [];
  const createdBookingRequestIds: number[] = [];

  let adminToken: string;
  let pillarSlug: string;
  let pillarId: number;
  let formatSlug: string;
  let countryId: number;

  async function signToken(user: User): Promise<string> {
    return jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async function createPublishedSpeaker(
    label: string,
    opts: { withPillarAndFormat?: boolean } = {},
  ): Promise<{ user: User; speakerId: number; token: string }> {
    const user = await prisma.user.create({
      data: {
        email: `e2e-match-${label}-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const speaker = await prisma.speaker.create({
      data: {
        userId: user.id,
        firstName: label,
        lastName: 'Speaker',
        slug: `e2e-match-${label}-${suffix}`,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        shortBio: 'Bio.',
        publishedAt: new Date(),
        pillars: opts.withPillarAndFormat
          ? { create: [{ pillarId, isPrimary: true }] }
          : undefined,
        formats: opts.withPillarAndFormat
          ? {
              create: [
                {
                  format: { connect: { slug: formatSlug } },
                },
              ],
            }
          : undefined,
      },
    });
    createdSpeakerIds.push(speaker.id);
    const token = await signToken(user);
    return { user, speakerId: speaker.id, token };
  }

  async function createBookingRequest(
    label: string,
    status: BookingStatus = BookingStatus.SELECTING_SPEAKERS,
  ): Promise<number> {
    // reference est @db.VarChar(30) : un identifiant descriptif complet
    // ("ASB-TEST-3D-<suffix>-transition-no") dépasserait la colonne et
    // serait tronqué par MySQL, avec un risque réel de collision entre deux
    // labels partageant leurs premiers caractères après troncature (constaté
    // en écrivant ce test : "transition-ok"/"transition-no" tronqués
    // devenaient identiques). Compteur court, largement sous la limite.
    refCounter += 1;
    const reference = `ASB-T3D-${suffix}-${refCounter}`;
    const row = await prisma.bookingRequest.create({
      data: {
        reference,
        serviceType: ServiceType.CONFERENCE,
        fullName: '[E2E] Matching Client',
        organization: '[E2E] Matching Org',
        workEmail: `e2e-match-client-${label}-${suffix}@example.com`,
        estimatedBudget: '$5,000 - $10,000',
        audienceSize: '100-200',
        eventDate: new Date('2027-09-15T00:00:00.000Z'),
        status,
      },
    });
    createdBookingRequestIds.push(row.id);
    return row.id;
  }

  beforeAll(async () => {
    mailService = {
      sendAvailabilityRequestNotification: jest
        .fn()
        .mockResolvedValue(undefined),
      sendAvailabilityResponseNotification: jest
        .fn()
        .mockResolvedValue(undefined),
      sendAvailabilityRequestExpired: jest.fn().mockResolvedValue(undefined),
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
    jwtService = app.get(JwtService);
    availabilityRequestsService = app.get(AvailabilityRequestsService);

    const adminUser = await prisma.user.create({
      data: {
        email: `e2e-match-admin-${suffix}@example.com`,
        role: Role.ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signToken(adminUser);

    const pillar = await prisma.pillar.findFirstOrThrow({
      select: { id: true, slug: true },
    });
    pillarId = pillar.id;
    pillarSlug = pillar.slug;
    const format = await prisma.format.findFirstOrThrow({
      select: { slug: true },
    });
    formatSlug = format.slug;
    const country = await prisma.country.findFirstOrThrow({
      select: { id: true },
    });
    countryId = country.id;
  });

  afterAll(async () => {
    await prisma.availabilityRequest.deleteMany({
      where: { bookingRequestId: { in: createdBookingRequestIds } },
    });
    await prisma.bookingRequestSpeaker.deleteMany({
      where: { requestId: { in: createdBookingRequestIds } },
    });
    await prisma.bookingRequest.deleteMany({
      where: { id: { in: createdBookingRequestIds } },
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

  // -------------------------------------------------------------------
  // §1 — Matching : réutilise checkAvailability(), pas de scoring.
  // -------------------------------------------------------------------
  describe('Matching (§1)', () => {
    it('un speaker avec une période UNAVAILABLE chevauchante est signalé indisponible', async () => {
      const speaker = await createPublishedSpeaker('unavailable', {
        withPillarAndFormat: true,
      });
      await prisma.speakerAvailabilityPeriod.create({
        data: {
          speakerId: speaker.speakerId,
          type: AvailabilityPeriodType.UNAVAILABLE,
          startDate: new Date('2027-09-10T00:00:00.000Z'),
          endDate: new Date('2027-09-20T00:00:00.000Z'),
        },
      });
      const bookingRequestId = await createBookingRequest('unavail-match');

      const res = await request(app.getHttpServer())
        .get(`/admin/booking-requests/${bookingRequestId}/matching-candidates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as MatchingResponseBody;
      const candidate = body.candidates.find(
        (c) => c.speaker.id === speaker.speakerId,
      );
      expect(candidate).toBeDefined();
      expect(candidate!.availability.status).toBe('UNAVAILABLE');
      expect(candidate!.availability.reasons.length).toBeGreaterThan(0);
    });

    it('un speaker sans aucune déclaration ressort en UNKNOWN et reste proposé (pas exclu)', async () => {
      const speaker = await createPublishedSpeaker('no-decl');
      const bookingRequestId = await createBookingRequest('unknown-match');

      const res = await request(app.getHttpServer())
        .get(`/admin/booking-requests/${bookingRequestId}/matching-candidates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as MatchingResponseBody;
      const candidate = body.candidates.find(
        (c) => c.speaker.id === speaker.speakerId,
      );
      expect(candidate).toBeDefined();
      expect(candidate!.availability.status).toBe('UNKNOWN');
    });

    it('critère pilier satisfait/non satisfait — pas un score', async () => {
      const withPillar = await createPublishedSpeaker('with-pillar', {
        withPillarAndFormat: true,
      });
      const withoutPillar = await createPublishedSpeaker('without-pillar');
      const bookingRequestId = await createBookingRequest('pillar-match');

      const res = await request(app.getHttpServer())
        .get(`/admin/booking-requests/${bookingRequestId}/matching-candidates`)
        .query({ pillar: pillarSlug })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as MatchingResponseBody;
      const withPillarCandidate = body.candidates.find(
        (c) => c.speaker.id === withPillar.speakerId,
      )!;
      const withoutPillarCandidate = body.candidates.find(
        (c) => c.speaker.id === withoutPillar.speakerId,
      )!;
      expect(
        withPillarCandidate.criteria.satisfied.some((s) =>
          s.startsWith('Pilier'),
        ),
      ).toBe(true);
      expect(
        withoutPillarCandidate.criteria.unsatisfied.some((s) =>
          s.startsWith('Pilier'),
        ),
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // §2 — Sélection de candidats.
  // -------------------------------------------------------------------
  describe('Sélection de candidats (§2)', () => {
    it('ajoute, réordonne, transitionne et retire un candidat', async () => {
      const speaker1 = await createPublishedSpeaker('sel1');
      const speaker2 = await createPublishedSpeaker('sel2');
      const bookingRequestId = await createBookingRequest('selection');

      const add1 = await request(app.getHttpServer())
        .post(`/admin/booking-requests/${bookingRequestId}/speakers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: speaker1.speakerId })
        .expect(201);
      expect((add1.body as BookingRequestSpeakerBody).status).toBe(
        'SHORTLISTED',
      );

      await request(app.getHttpServer())
        .post(`/admin/booking-requests/${bookingRequestId}/speakers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: speaker2.speakerId })
        .expect(201);

      // Réordonnancement.
      await request(app.getHttpServer())
        .put(`/admin/booking-requests/${bookingRequestId}/speakers/reorder`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderedSpeakerIds: [speaker2.speakerId, speaker1.speakerId],
        })
        .expect(200);

      const list = await request(app.getHttpServer())
        .get(`/admin/booking-requests/${bookingRequestId}/speakers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const listBody = list.body as BookingRequestSpeakerBody[];
      expect(listBody[0].speaker.id).toBe(speaker2.speakerId);

      // Transition interdite : SHORTLISTED -> PROPOSED_TO_CLIENT direct.
      await request(app.getHttpServer())
        .patch(
          `/admin/booking-requests/${bookingRequestId}/speakers/${speaker1.speakerId}/status`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PROPOSED_TO_CLIENT' })
        .expect(400);

      // Retrait.
      await request(app.getHttpServer())
        .delete(
          `/admin/booking-requests/${bookingRequestId}/speakers/${speaker1.speakerId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const afterRemoval = await request(app.getHttpServer())
        .get(`/admin/booking-requests/${bookingRequestId}/speakers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        (afterRemoval.body as BookingRequestSpeakerBody[]).map(
          (s) => s.speaker.id,
        ),
      ).not.toContain(speaker1.speakerId);
    });

    it('remplace un speaker SPEAKER_UNAVAILABLE (§7) — refuse depuis un autre statut', async () => {
      const speaker1 = await createPublishedSpeaker('replace-src');
      const speaker2 = await createPublishedSpeaker('replace-dst');
      const bookingRequestId = await createBookingRequest('replace');

      await request(app.getHttpServer())
        .post(`/admin/booking-requests/${bookingRequestId}/speakers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: speaker1.speakerId })
        .expect(201);

      // Encore SHORTLISTED : le remplacement doit être refusé.
      await request(app.getHttpServer())
        .post(
          `/admin/booking-requests/${bookingRequestId}/speakers/${speaker1.speakerId}/replace`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ replacementSpeakerId: speaker2.speakerId })
        .expect(400);

      await prisma.bookingRequestSpeaker.updateMany({
        where: { requestId: bookingRequestId, speakerId: speaker1.speakerId },
        data: { status: 'SPEAKER_UNAVAILABLE' },
      });

      const replaced = await request(app.getHttpServer())
        .post(
          `/admin/booking-requests/${bookingRequestId}/speakers/${speaker1.speakerId}/replace`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ replacementSpeakerId: speaker2.speakerId })
        .expect(201);
      expect((replaced.body as BookingRequestSpeakerBody).speaker.id).toBe(
        speaker2.speakerId,
      );

      const oldRow = await prisma.bookingRequestSpeaker.findFirst({
        where: { requestId: bookingRequestId, speakerId: speaker1.speakerId },
      });
      expect(oldRow?.status).toBe('WITHDRAWN');
    });
  });

  // -------------------------------------------------------------------
  // §3/§3.1 — Envoi de sollicitations, FRONTIÈRE ADMIN <-> SPEAKER.
  // -------------------------------------------------------------------
  describe('Envoi de sollicitations (§3)', () => {
    async function shortlist(bookingRequestId: number, speakerId: number) {
      await request(app.getHttpServer())
        .post(`/admin/booking-requests/${bookingRequestId}/speakers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId })
        .expect(201);
    }

    function sendPayload(bookingRequestId: number, speakerId: number) {
      return {
        bookingRequestId,
        speakerId,
        eventType: 'Conference',
        eventDate: '2027-09-15',
        topic: 'Digital transformation in Africa',
        isVirtual: false,
        locationCountryId: countryId,
        proposedFeeAmount: 4000,
        proposedFeeCurrency: 'USD',
        travelConditions: 'Business class, 2 nights hotel',
      };
    }

    it(
      'LE test le plus important : le briefing reçu par le speaker ne ' +
        'contient AUCUNE donnée client — assertion sur la sérialisation complète',
      async () => {
        const speaker = await createPublishedSpeaker('privacy');
        const bookingRequestId = await createBookingRequest(
          'privacy',
          BookingStatus.PROPOSAL_SENT,
        );
        await shortlist(bookingRequestId, speaker.speakerId);

        await request(app.getHttpServer())
          .post('/admin/availability-requests')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(sendPayload(bookingRequestId, speaker.speakerId))
          .expect(201);

        const list = await request(app.getHttpServer())
          .get('/speaker/me/opportunities')
          .set('Authorization', `Bearer ${speaker.token}`)
          .expect(200);
        const opportunity = (list.body as OpportunityBody[])[0];

        const detail = await request(app.getHttpServer())
          .get(`/speaker/me/opportunities/${opportunity.id}`)
          .set('Authorization', `Bearer ${speaker.token}`)
          .expect(200);

        // Champs INTERDITS — identité/budget client, notes internes,
        // commission, référence à la demande ou aux autres speakers.
        const serialized = JSON.stringify(detail.body).toLowerCase();
        const forbidden = [
          'bookingrequestid',
          'sentbyid',
          'sentbyemail',
          '"organization"',
          '"workemail"',
          '"fullname"',
          'estimatedbudget',
          'internalnotes',
          'commission',
          'contactid',
          'clientname',
        ];
        for (const key of forbidden) {
          expect(serialized).not.toContain(key.toLowerCase());
        }
        // Positif : ce qu'il DOIT voir est bien là.
        expect(detail.body).toHaveProperty('topic');
        expect(detail.body).toHaveProperty('proposedFeeAmount');
        expect(detail.body).toHaveProperty('respondDueAt');
      },
    );

    it('speaker B reçoit 404 sur une opportunité du speaker A (lecture ET réponse)', async () => {
      const speakerA = await createPublishedSpeaker('cross-a');
      const speakerB = await createPublishedSpeaker('cross-b');
      const bookingRequestId = await createBookingRequest('cross');
      await shortlist(bookingRequestId, speakerA.speakerId);

      const sent = await request(app.getHttpServer())
        .post('/admin/availability-requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(sendPayload(bookingRequestId, speakerA.speakerId))
        .expect(201);
      const requestId = (sent.body as AvailabilityRequestAdminBody).id;

      await request(app.getHttpServer())
        .get(`/speaker/me/opportunities/${requestId}`)
        .set('Authorization', `Bearer ${speakerB.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .post(`/speaker/me/opportunities/${requestId}/respond`)
        .set('Authorization', `Bearer ${speakerB.token}`)
        .send({ status: 'AVAILABLE_INTERESTED' })
        .expect(404);
    });

    it('deux envois concurrents pour le même (demande, speaker) : un seul réussit, le second 409', async () => {
      const speaker = await createPublishedSpeaker('concurrent');
      const bookingRequestId = await createBookingRequest('concurrent');
      await shortlist(bookingRequestId, speaker.speakerId);

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/admin/availability-requests')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(sendPayload(bookingRequestId, speaker.speakerId)),
        request(app.getHttpServer())
          .post('/admin/availability-requests')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(sendPayload(bookingRequestId, speaker.speakerId)),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const count = await prisma.availabilityRequest.count({
        where: { bookingRequestId, speakerId: speaker.speakerId },
      });
      expect(count).toBe(1);
    });

    it(
      "l'envoi PEUT faire passer la demande en AWAITING_SPEAKER via la " +
        'matrice de la 3b — mais pas depuis un statut qui ne le permet pas',
      async () => {
        const speakerAllowed = await createPublishedSpeaker('transition-ok');
        const bookingRequestAllowed = await createBookingRequest(
          'transition-ok',
          BookingStatus.PROPOSAL_SENT,
        );
        await shortlist(bookingRequestAllowed, speakerAllowed.speakerId);
        await request(app.getHttpServer())
          .post('/admin/availability-requests')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(sendPayload(bookingRequestAllowed, speakerAllowed.speakerId))
          .expect(201);
        const allowedRow = await prisma.bookingRequest.findUniqueOrThrow({
          where: { id: bookingRequestAllowed },
        });
        expect(allowedRow.status).toBe('AWAITING_SPEAKER');

        const speakerBlocked = await createPublishedSpeaker('transition-no');
        const bookingRequestBlocked = await createBookingRequest(
          'transition-no',
          BookingStatus.NEW,
        );
        await shortlist(bookingRequestBlocked, speakerBlocked.speakerId);
        await request(app.getHttpServer())
          .post('/admin/availability-requests')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(sendPayload(bookingRequestBlocked, speakerBlocked.speakerId))
          .expect(201);
        const blockedRow = await prisma.bookingRequest.findUniqueOrThrow({
          where: { id: bookingRequestBlocked },
        });
        // NEW -> AWAITING_SPEAKER n'est pas dans la matrice : reste NEW,
        // et ce n'est PAS une erreur (l'envoi de la sollicitation a réussi).
        expect(blockedRow.status).toBe('NEW');
      },
    );
  });

  // -------------------------------------------------------------------
  // §3.4/§3.5/§4 — Réponse, expiration, non-engagement.
  // -------------------------------------------------------------------
  describe('Réponse, expiration, non-engagement (§3.4, §3.5)', () => {
    async function sendAndGetOpportunity(
      label: string,
      bookingStatus: BookingStatus = BookingStatus.SELECTING_SPEAKERS,
    ) {
      const speaker = await createPublishedSpeaker(label);
      const bookingRequestId = await createBookingRequest(label, bookingStatus);
      await request(app.getHttpServer())
        .post(`/admin/booking-requests/${bookingRequestId}/speakers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: speaker.speakerId })
        .expect(201);
      const sent = await request(app.getHttpServer())
        .post('/admin/availability-requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bookingRequestId,
          speakerId: speaker.speakerId,
          eventType: 'Conference',
          eventDate: '2027-09-15',
          topic: 'Topic',
        })
        .expect(201);
      return {
        speaker,
        bookingRequestId,
        requestId: (sent.body as AvailabilityRequestAdminBody).id,
      };
    }

    it(
      'AVAILABLE_INTERESTED ne crée aucune mission et ne change PAS la ' +
        'demande client en CONFIRMED',
      async () => {
        const { speaker, bookingRequestId, requestId } =
          await sendAndGetOpportunity('respond-available');

        await request(app.getHttpServer())
          .post(`/speaker/me/opportunities/${requestId}/respond`)
          .set('Authorization', `Bearer ${speaker.token}`)
          .send({ status: 'AVAILABLE_INTERESTED' })
          .expect(201);

        const bookingRequest = await prisma.bookingRequest.findUniqueOrThrow({
          where: { id: bookingRequestId },
        });
        expect(bookingRequest.status).not.toBe('CONFIRMED');

        const candidate = await prisma.bookingRequestSpeaker.findFirstOrThrow({
          where: { requestId: bookingRequestId, speakerId: speaker.speakerId },
        });
        expect(candidate.status).toBe('SPEAKER_AVAILABLE');
      },
    );

    it('le commentaire privé du speaker est visible côté admin (aucune projection client n’existe à ce jour)', async () => {
      const { speaker, requestId, bookingRequestId } =
        await sendAndGetOpportunity('private-comment');

      await request(app.getHttpServer())
        .post(`/speaker/me/opportunities/${requestId}/respond`)
        .set('Authorization', `Bearer ${speaker.token}`)
        .send({
          status: 'AVAILABLE_WITH_CONDITIONS',
          speakerPrivateComment: 'Uniquement si le vol est en classe affaires.',
        })
        .expect(201);

      const row = await prisma.availabilityRequest.findFirstOrThrow({
        where: { bookingRequestId, speakerId: speaker.speakerId },
      });
      expect(row.speakerPrivateComment).toContain('classe affaires');
    });

    it('une opportunité déjà répondue refuse une seconde réponse', async () => {
      const { speaker, requestId } =
        await sendAndGetOpportunity('double-respond');

      await request(app.getHttpServer())
        .post(`/speaker/me/opportunities/${requestId}/respond`)
        .set('Authorization', `Bearer ${speaker.token}`)
        .send({ status: 'AVAILABLE_INTERESTED' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/speaker/me/opportunities/${requestId}/respond`)
        .set('Authorization', `Bearer ${speaker.token}`)
        .send({ status: 'UNAVAILABLE' })
        .expect(400);
      expect((res.body as ErrorResponseBody).message).toContain('déjà reçu');
    });

    it('une demande expirée ne peut plus être répondue', async () => {
      const { speaker, requestId } = await sendAndGetOpportunity('expiring');

      // Force l'expiration : recule respondDueAt puis déclenche le même
      // traitement que le scheduler horaire (§3.4).
      await prisma.availabilityRequest.update({
        where: { id: requestId },
        data: { respondDueAt: new Date(Date.now() - 1000) },
      });
      await availabilityRequestsService.expireOverdueAndNotify(new Date());

      const row = await prisma.availabilityRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(row.status).toBe('EXPIRED');

      const res = await request(app.getHttpServer())
        .post(`/speaker/me/opportunities/${requestId}/respond`)
        .set('Authorization', `Bearer ${speaker.token}`)
        .send({ status: 'AVAILABLE_INTERESTED' })
        .expect(400);
      expect((res.body as ErrorResponseBody).message).toContain(
        "n'est plus ouverte",
      );
      expect(mailService.sendAvailabilityRequestExpired).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // Matrice de transitions BookingRequestSpeakerStatus — mêmes garanties
  // que la 3b/3c (transitions autorisées OK, interdites refusées,
  // aucun état terminal réatteignable).
  // -------------------------------------------------------------------
  describe('Matrice de transitions BookingRequestSpeakerStatus', () => {
    it('CLIENT_DECLINED et SELECTED sont terminaux (aucune transition sortante)', async () => {
      const speaker = await createPublishedSpeaker('terminal');
      const bookingRequestId = await createBookingRequest('terminal');
      await request(app.getHttpServer())
        .post(`/admin/booking-requests/${bookingRequestId}/speakers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: speaker.speakerId })
        .expect(201);

      await prisma.bookingRequestSpeaker.updateMany({
        where: { requestId: bookingRequestId, speakerId: speaker.speakerId },
        data: { status: 'CLIENT_DECLINED' },
      });

      const res = await request(app.getHttpServer())
        .patch(
          `/admin/booking-requests/${bookingRequestId}/speakers/${speaker.speakerId}/status`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SELECTED' })
        .expect(400);
      expect((res.body as ErrorResponseBody).message).toContain(
        'statut terminal',
      );
    });
  });
});
