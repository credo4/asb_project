import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  BookingStatus,
  Role,
  ServiceType,
  SpeakerStatus,
  User,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { configureApp } from '../src/app.config';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
}
interface MissionAdminBody {
  id: number;
  reference: string;
  status: string;
  checklist: { id: number; code: string; isDone: boolean }[];
  checklistProgressPercent: number;
  documents: { id: number }[];
  messages: { id: number }[];
  [key: string]: unknown;
}
interface MissionSpeakerBody {
  id: number;
  status: string;
  [key: string]: unknown;
}
interface DocumentBody {
  id: number;
  isSharedWithSpeaker: boolean;
}
interface DownloadLinkBody {
  url: string;
}

const validPdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
);

// Couvre le prompt Phase 3, étape 3e (§10) : frontière financière speaker
// (LE test le plus important de cette étape), cloisonnement 404 entre
// speakers, idempotence de la création portée par la base (409 sur appel
// concurrent réel), sauts en avant/retours en arrière SUPER_ADMIN,
// annulation qui n'affecte pas la demande client, checklist instanciée à
// 15 points, documents partagés/non partagés et révocation après
// suppression, acceptation impossible sur mission annulée.
describe('Missions (Phase 3e) API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let mailService: Record<string, jest.Mock>;

  const suffix = Date.now();
  let refCounter = 0;
  const createdUserIds: number[] = [];
  const createdSpeakerIds: number[] = [];
  const createdBookingRequestIds: number[] = [];
  const createdOrganizationIds: number[] = [];

  let adminToken: string;
  let superAdminToken: string;

  async function signToken(user: {
    id: number;
    email: string;
    role: Role;
  }): Promise<string> {
    return jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async function createPublishedSpeaker(
    label: string,
  ): Promise<{ user: User; speakerId: number; token: string }> {
    const user = await prisma.user.create({
      data: {
        email: `e2e-mission-${label}-${suffix}@example.com`,
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
        slug: `e2e-mission-${label}-${suffix}`,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        shortBio: 'Bio.',
        publishedAt: new Date(),
      },
    });
    createdSpeakerIds.push(speaker.id);
    const token = await signToken(user);
    return { user, speakerId: speaker.id, token };
  }

  async function createOrganization(label: string): Promise<number> {
    const org = await prisma.organization.create({
      data: { name: `[E2E] Mission Org ${label} ${suffix}` },
    });
    createdOrganizationIds.push(org.id);
    return org.id;
  }

  async function createConfirmedBookingRequest(
    label: string,
    organizationId?: number,
    status: BookingStatus = BookingStatus.CONFIRMED,
  ): Promise<number> {
    refCounter += 1;
    const row = await prisma.bookingRequest.create({
      data: {
        reference: `ASB-MSN-${suffix}-${refCounter}`,
        serviceType: ServiceType.CONFERENCE,
        fullName: '[E2E] Mission Client',
        organization: '[E2E] Mission Client Org',
        workEmail: `e2e-mission-client-${label}-${suffix}@example.com`,
        eventDate: new Date('2027-10-01T00:00:00.000Z'),
        primaryTopics: 'Digital transformation',
        organizationId,
        status,
      },
    });
    createdBookingRequestIds.push(row.id);
    return row.id;
  }

  async function shortlist(bookingRequestId: number, speakerId: number) {
    await request(app.getHttpServer())
      .post(`/admin/booking-requests/${bookingRequestId}/speakers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ speakerId })
      .expect(201);
  }

  async function createMission(
    bookingRequestId: number,
    speakerId: number,
  ): Promise<MissionAdminBody> {
    const res = await request(app.getHttpServer())
      .post(`/admin/booking-requests/${bookingRequestId}/missions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ speakerId })
      .expect(201);
    return res.body as MissionAdminBody;
  }

  beforeAll(async () => {
    mailService = {
      sendMissionCreatedNotification: jest.fn().mockResolvedValue(undefined),
      sendMissionConfirmedNotification: jest.fn().mockResolvedValue(undefined),
      sendMissionAcceptedNotification: jest.fn().mockResolvedValue(undefined),
      sendMissionDocumentDepositedNotification: jest
        .fn()
        .mockResolvedValue(undefined),
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

    const adminUser = await prisma.user.create({
      data: {
        email: `e2e-mission-admin-${suffix}@example.com`,
        role: Role.ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signToken(adminUser);

    const superAdminUser = await prisma.user.create({
      data: {
        email: `e2e-mission-superadmin-${suffix}@example.com`,
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(superAdminUser.id);
    superAdminToken = await signToken(superAdminUser);
  });

  afterAll(async () => {
    const missionIds = await prisma.mission.findMany({
      where: { bookingRequestId: { in: createdBookingRequestIds } },
      select: { id: true },
    });
    const ids = missionIds.map((m) => m.id);
    await prisma.missionMessage.deleteMany({
      where: { missionId: { in: ids } },
    });
    await prisma.missionDocument.deleteMany({
      where: { missionId: { in: ids } },
    });
    await prisma.missionChecklistItem.deleteMany({
      where: { missionId: { in: ids } },
    });
    await prisma.mission.deleteMany({ where: { id: { in: ids } } });
    await prisma.bookingRequestSpeaker.deleteMany({
      where: { requestId: { in: createdBookingRequestIds } },
    });
    await prisma.bookingRequest.deleteMany({
      where: { id: { in: createdBookingRequestIds } },
    });
    await prisma.speaker.deleteMany({
      where: { id: { in: createdSpeakerIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.organization.deleteMany({
      where: { id: { in: createdOrganizationIds } },
    });
    await app.close();
  });

  describe('Création (§1)', () => {
    it('crée une mission, passe le rattachement en SELECTED, instancie la checklist à 15 points', async () => {
      const speaker = await createPublishedSpeaker('create');
      const organizationId = await createOrganization('create');
      const bookingRequestId = await createConfirmedBookingRequest(
        'create',
        organizationId,
      );
      await shortlist(bookingRequestId, speaker.speakerId);

      const mission = await createMission(bookingRequestId, speaker.speakerId);
      expect(mission.reference).toMatch(/^MSN-\d{4}-\d{6}$/);
      expect(mission.status).toBe('PREPARATION');
      expect(mission.checklist).toHaveLength(15);
      expect(mission.checklistProgressPercent).toBe(0);

      const candidate = await prisma.bookingRequestSpeaker.findFirstOrThrow({
        where: { requestId: bookingRequestId, speakerId: speaker.speakerId },
      });
      expect(candidate.status).toBe('SELECTED');
      expect(mailService.sendMissionCreatedNotification).toHaveBeenCalled();
    });

    it("refuse la création si la demande n'est ni CONFIRMED ni CONTRACT_IN_PREPARATION", async () => {
      const speaker = await createPublishedSpeaker('wrong-status');
      const bookingRequestId = await createConfirmedBookingRequest(
        'wrong-status',
        undefined,
        BookingStatus.NEW,
      );
      await shortlist(bookingRequestId, speaker.speakerId);

      const res = await request(app.getHttpServer())
        .post(`/admin/booking-requests/${bookingRequestId}/missions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: speaker.speakerId })
        .expect(400);
      expect((res.body as ErrorResponseBody).message).toContain('CONFIRMED');
    });

    it("refuse si le speaker n'est pas rattaché via booking_request_speakers", async () => {
      const speaker = await createPublishedSpeaker('not-shortlisted');
      const bookingRequestId =
        await createConfirmedBookingRequest('not-shortlisted');

      await request(app.getHttpServer())
        .post(`/admin/booking-requests/${bookingRequestId}/missions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ speakerId: speaker.speakerId })
        .expect(400);
    });

    it('deux créations concurrentes pour le même (demande, speaker) : une seule réussit, la seconde 409', async () => {
      const speaker = await createPublishedSpeaker('concurrent');
      const bookingRequestId =
        await createConfirmedBookingRequest('concurrent');
      await shortlist(bookingRequestId, speaker.speakerId);

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/admin/booking-requests/${bookingRequestId}/missions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ speakerId: speaker.speakerId }),
        request(app.getHttpServer())
          .post(`/admin/booking-requests/${bookingRequestId}/missions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ speakerId: speaker.speakerId }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const count = await prisma.mission.count({
        where: { bookingRequestId, speakerId: speaker.speakerId },
      });
      expect(count).toBe(1);
    });
  });

  describe('Frontière financière speaker (§5) — LE test le plus important', () => {
    it('le DTO speaker ne contient NI clientAmount NI agencyCommission NI internalNotes — sérialisation complète', async () => {
      const speaker = await createPublishedSpeaker('financial');
      const organizationId = await createOrganization('financial');
      const bookingRequestId = await createConfirmedBookingRequest(
        'financial',
        organizationId,
      );
      await shortlist(bookingRequestId, speaker.speakerId);
      const mission = await createMission(bookingRequestId, speaker.speakerId);

      await request(app.getHttpServer())
        .patch(`/admin/missions/${mission.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientAmount: 10000,
          speakerAmount: 4000,
          agencyCommission: 6000,
          expenses: 500,
          internalNotes: 'Négociation tendue, ne pas révéler la marge.',
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/speaker/me/missions/${mission.id}`)
        .set('Authorization', `Bearer ${speaker.token}`)
        .expect(200);

      const serialized = JSON.stringify(res.body).toLowerCase();
      const forbidden = [
        'clientamount',
        'agencycommission',
        'internalnotes',
        'contactid',
        'createdbyid',
        'contractstatus',
        'paymentstatus',
      ];
      for (const key of forbidden) {
        expect(serialized).not.toContain(key);
      }

      const body = res.body as MissionSpeakerBody;
      expect(body.speakerAmount).toBe('4000');
      expect(body.expenses).toBe('500');
      expect(body.organizationName).toContain('Mission Org financial');
    });
  });

  describe('Cloisonnement entre speakers (§6)', () => {
    it('speaker B reçoit 404 sur la mission du speaker A (lecture, acceptation, dépôt de document)', async () => {
      const speakerA = await createPublishedSpeaker('cross-a');
      const speakerB = await createPublishedSpeaker('cross-b');
      const bookingRequestId = await createConfirmedBookingRequest('cross');
      await shortlist(bookingRequestId, speakerA.speakerId);
      const mission = await createMission(bookingRequestId, speakerA.speakerId);

      await request(app.getHttpServer())
        .get(`/speaker/me/missions/${mission.id}`)
        .set('Authorization', `Bearer ${speakerB.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .post(`/speaker/me/missions/${mission.id}/accept`)
        .set('Authorization', `Bearer ${speakerB.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .post(`/speaker/me/missions/${mission.id}/documents`)
        .set('Authorization', `Bearer ${speakerB.token}`)
        .field('type', 'PRESENTATION')
        .attach('file', validPdfBuffer, 'presentation.pdf')
        .expect(404);
    });
  });

  describe('Machine à états — sauts en avant / retours en arrière (§3)', () => {
    it('un saut en avant est autorisé ; un retour arrière est refusé pour ADMIN et accepté pour SUPER_ADMIN (journalisé)', async () => {
      const speaker = await createPublishedSpeaker('jump');
      const bookingRequestId = await createConfirmedBookingRequest('jump');
      await shortlist(bookingRequestId, speaker.speakerId);
      const mission = await createMission(bookingRequestId, speaker.speakerId);

      // Saut en avant : PREPARATION -> CONTRACT_SIGNED (saute plusieurs
      // étapes idéalisées, §3 — pas d'acompte demandé, contrat signé avant
      // devis formel : exactement le cas pratique cité dans le prompt).
      await request(app.getHttpServer())
        .patch(`/admin/missions/${mission.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONTRACT_SIGNED' })
        .expect(200);

      // Retour en arrière refusé pour un ADMIN.
      const refused = await request(app.getHttpServer())
        .patch(`/admin/missions/${mission.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'QUOTE_SENT' })
        .expect(400);
      expect((refused.body as ErrorResponseBody).message).toContain(
        'SUPER_ADMIN',
      );

      // Accepté pour un SUPER_ADMIN.
      const reverted = await request(app.getHttpServer())
        .patch(`/admin/missions/${mission.id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'QUOTE_SENT' })
        .expect(200);
      expect((reverted.body as MissionAdminBody).status).toBe('QUOTE_SENT');

      const history = await request(app.getHttpServer())
        .get(`/admin/missions/${mission.id}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const entries = history.body as { action: string }[];
      expect(entries.some((e) => e.action === 'mission.status_reverted')).toBe(
        true,
      );
    });

    it('annuler une mission (motif obligatoire) ne modifie PAS le statut de la demande client', async () => {
      const speaker = await createPublishedSpeaker('cancel');
      const bookingRequestId = await createConfirmedBookingRequest('cancel');
      await shortlist(bookingRequestId, speaker.speakerId);
      const mission = await createMission(bookingRequestId, speaker.speakerId);

      await request(app.getHttpServer())
        .patch(`/admin/missions/${mission.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELLED' })
        .expect(400); // motif manquant

      await request(app.getHttpServer())
        .patch(`/admin/missions/${mission.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'CANCELLED',
          cancellationReason: 'Le client a annulé son événement.',
        })
        .expect(200);

      const bookingRequest = await prisma.bookingRequest.findUniqueOrThrow({
        where: { id: bookingRequestId },
      });
      expect(bookingRequest.status).toBe('CONFIRMED');

      // Une mission annulée ne peut plus être acceptée (§6).
      const res = await request(app.getHttpServer())
        .post(`/speaker/me/missions/${mission.id}/accept`)
        .set('Authorization', `Bearer ${speaker.token}`)
        .expect(400);
      expect((res.body as ErrorResponseBody).message).toContain('annulée');
    });
  });

  describe('Checklist (§4)', () => {
    it('le pourcentage d’avancement est correct après quelques coches', async () => {
      const speaker = await createPublishedSpeaker('checklist');
      const bookingRequestId = await createConfirmedBookingRequest('checklist');
      await shortlist(bookingRequestId, speaker.speakerId);
      const mission = await createMission(bookingRequestId, speaker.speakerId);
      expect(mission.checklist).toHaveLength(15);

      const firstThree = mission.checklist.slice(0, 3);
      for (const item of firstThree) {
        await request(app.getHttpServer())
          .patch(`/admin/missions/${mission.id}/checklist/${item.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ isDone: true })
          .expect(200);
      }

      const detail = await request(app.getHttpServer())
        .get(`/admin/missions/${mission.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = detail.body as MissionAdminBody;
      expect(body.checklistProgressPercent).toBe(20); // 3/15
    });
  });

  describe('Documents (§7)', () => {
    it('un document non partagé est invisible du speaker ; supprimé, il devient introuvable même avec un lien signé encore valide', async () => {
      const speaker = await createPublishedSpeaker('docs');
      const bookingRequestId = await createConfirmedBookingRequest('docs');
      await shortlist(bookingRequestId, speaker.speakerId);
      const mission = await createMission(bookingRequestId, speaker.speakerId);

      const uploaded = await request(app.getHttpServer())
        .post(`/admin/missions/${mission.id}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('type', 'CONTRACT')
        .field('isSharedWithSpeaker', 'false')
        .attach('file', validPdfBuffer, 'contract.pdf')
        .expect(201);
      const documentId = (uploaded.body as DocumentBody).id;

      const speakerList = await request(app.getHttpServer())
        .get(`/speaker/me/missions/${mission.id}/documents`)
        .set('Authorization', `Bearer ${speaker.token}`)
        .expect(200);
      expect(
        (speakerList.body as DocumentBody[]).some((d) => d.id === documentId),
      ).toBe(false);

      const linkRes = await request(app.getHttpServer())
        .get(
          `/admin/missions/${mission.id}/documents/${documentId}/download-link`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const { url } = linkRes.body as DownloadLinkBody;
      const path = url.replace(/^https?:\/\/[^/]+/, '');

      await request(app.getHttpServer()).get(path).expect(200);

      await request(app.getHttpServer())
        .delete(`/admin/missions/${mission.id}/documents/${documentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Lien encore valide (pas expiré), mais la ressource a disparu : 404,
      // jamais 410 (même règle que speaker_documents/booking_request_attachments).
      await request(app.getHttpServer()).get(path).expect(404);
    });

    it('un document partagé (isSharedWithSpeaker=true) est visible du speaker', async () => {
      const speaker = await createPublishedSpeaker('docs-shared');
      const bookingRequestId =
        await createConfirmedBookingRequest('docs-shared');
      await shortlist(bookingRequestId, speaker.speakerId);
      const mission = await createMission(bookingRequestId, speaker.speakerId);

      const uploaded = await request(app.getHttpServer())
        .post(`/admin/missions/${mission.id}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('type', 'BRIEF')
        .field('isSharedWithSpeaker', 'true')
        .attach('file', validPdfBuffer, 'brief.pdf')
        .expect(201);
      const documentId = (uploaded.body as DocumentBody).id;

      const speakerList = await request(app.getHttpServer())
        .get(`/speaker/me/missions/${mission.id}/documents`)
        .set('Authorization', `Bearer ${speaker.token}`)
        .expect(200);
      expect(
        (speakerList.body as DocumentBody[]).some((d) => d.id === documentId),
      ).toBe(true);
    });
  });

  describe('Acceptation (§6)', () => {
    it("l'acceptation est distincte de la réponse de disponibilité — enregistre acceptedAt/acceptedBy, refuse une seconde acceptation", async () => {
      const speaker = await createPublishedSpeaker('accept');
      const bookingRequestId = await createConfirmedBookingRequest('accept');
      await shortlist(bookingRequestId, speaker.speakerId);
      const mission = await createMission(bookingRequestId, speaker.speakerId);

      const res = await request(app.getHttpServer())
        .post(`/speaker/me/missions/${mission.id}/accept`)
        .set('Authorization', `Bearer ${speaker.token}`)
        .expect(201);
      expect((res.body as MissionSpeakerBody).acceptedAt).not.toBeNull();
      expect(mailService.sendMissionAcceptedNotification).toHaveBeenCalled();

      const row = await prisma.mission.findUniqueOrThrow({
        where: { id: mission.id },
      });
      expect(row.acceptedById).toBe(speaker.user.id);

      await request(app.getHttpServer())
        .post(`/speaker/me/missions/${mission.id}/accept`)
        .set('Authorization', `Bearer ${speaker.token}`)
        .expect(400);
    });
  });
});
