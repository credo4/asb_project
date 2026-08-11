import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role, ServiceType, User } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { configureApp } from '../src/app.config';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
}
interface AckResponseBody {
  reference: string;
}
interface BookingRequestDetailBody {
  id: number;
  status: string;
  isOverdue: boolean;
  firstRespondedAt: string | null;
  responseDueAt: string | null;
  notes: { id: number; body: string }[];
  linkedContact: { id: number } | null;
}
interface AttachmentBody {
  id: number;
}
interface DownloadLinkBody {
  url: string;
}
interface ContactBody {
  id: number;
}

// Ces tests couvrent le §6 du prompt Phase 3b : machine à états, statuts
// terminaux + réouverture, notes en ajout seul, pièces jointes (cloisonnement
// + révocation), isOverdue, consentement en transition douce, périmètre
// admin des notes, et la non-régression du rattachement CRM (3a).
describe('Booking request workflow (Phase 3b) API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let mailService: {
    sendBookingRequestTeamNotification: jest.Mock;
    sendBookingRequestAcknowledgment: jest.Mock;
    sendBookingRequestAssigned: jest.Mock;
    sendBookingRequestReminder: jest.Mock;
  };

  const suffix = Date.now();
  const createdUserIds: number[] = [];
  const createdBookingReferences: string[] = [];
  const createdContactIds: number[] = [];

  let adminToken: string;
  let superAdminToken: string;
  let speakerToken: string;

  async function signToken(user: User): Promise<string> {
    return jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  function manualPayload(overrides: Record<string, unknown> = {}) {
    return {
      serviceType: ServiceType.CONFERENCE,
      fullName: 'Manual Client',
      organization: 'Manual Org',
      workEmail: `manual-${suffix}-${Math.random().toString(36).slice(2)}@example.com`,
      eventName: 'Manual Event',
      eventDate: '2027-06-01',
      eventLocation: 'Abidjan',
      audienceSize: '50-100',
      ...overrides,
    };
  }

  async function createManualRequest(
    overrides: Record<string, unknown> = {},
  ): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/admin/booking-requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(manualPayload(overrides))
      .expect(201);
    const body = res.body as BookingRequestDetailBody;
    return body.id;
  }

  beforeAll(async () => {
    mailService = {
      sendBookingRequestTeamNotification: jest
        .fn()
        .mockResolvedValue(undefined),
      sendBookingRequestAcknowledgment: jest.fn().mockResolvedValue(undefined),
      sendBookingRequestAssigned: jest.fn().mockResolvedValue(undefined),
      sendBookingRequestReminder: jest.fn().mockResolvedValue(undefined),
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
        email: `e2e-workflow-admin-${suffix}@example.com`,
        role: Role.ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signToken(adminUser);

    const superAdminUser = await prisma.user.create({
      data: {
        email: `e2e-workflow-superadmin-${suffix}@example.com`,
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(superAdminUser.id);
    superAdminToken = await signToken(superAdminUser);

    const speakerUser = await prisma.user.create({
      data: {
        email: `e2e-workflow-speaker-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(speakerUser.id);
    speakerToken = await signToken(speakerUser);
  });

  afterAll(async () => {
    await prisma.bookingRequestNote.deleteMany({
      where: { request: { reference: { in: createdBookingReferences } } },
    });
    await prisma.bookingRequestAttachment.deleteMany({
      where: { request: { reference: { in: createdBookingReferences } } },
    });
    await prisma.reminder.deleteMany({
      where: { request: { reference: { in: createdBookingReferences } } },
    });
    await prisma.bookingRequest.deleteMany({
      where: { reference: { in: createdBookingReferences } },
    });
    await prisma.contact.deleteMany({
      where: { id: { in: createdContactIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  async function trackReference(id: number): Promise<void> {
    const row = await prisma.bookingRequest.findUniqueOrThrow({
      where: { id },
      select: { reference: true },
    });
    createdBookingReferences.push(row.reference);
  }

  describe('§3 — création manuelle', () => {
    it('POST /admin/booking-requests crée une demande source=MANUAL_ENTRY', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/booking-requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(manualPayload())
        .expect(201);
      const body = res.body as BookingRequestDetailBody;
      await trackReference(body.id);

      const row = await prisma.bookingRequest.findUniqueOrThrow({
        where: { id: body.id },
      });
      expect(row.source).toBe('MANUAL_ENTRY');
    });

    it('refuse un token SPEAKER', async () => {
      await request(app.getHttpServer())
        .post('/admin/booking-requests')
        .set('Authorization', `Bearer ${speakerToken}`)
        .send(manualPayload())
        .expect(403);
    });
  });

  describe('§1 — machine à états : transitions autorisées', () => {
    it('chaque transition du chemin nominal fonctionne (NEW -> ... -> CLOSED)', async () => {
      const id = await createManualRequest();
      await trackReference(id);

      const path = [
        'TO_QUALIFY',
        'UNDER_ANALYSIS',
        'SELECTING_SPEAKERS',
        'PROPOSAL_SENT',
        'AWAITING_CLIENT',
        'CONFIRMED',
        'CONTRACT_IN_PREPARATION',
        'CLOSED',
      ];

      for (const status of path) {
        const res = await request(app.getHttpServer())
          .patch(`/admin/booking-requests/${id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status })
          .expect(200);
        expect((res.body as BookingRequestDetailBody).status).toBe(status);
      }
    });
  });

  describe('§1 — machine à états : transitions interdites', () => {
    it('refuse NEW -> CONFIRMED (saute plusieurs étapes), message liste les options valides', async () => {
      const id = await createManualRequest();
      await trackReference(id);

      const res = await request(app.getHttpServer())
        .patch(`/admin/booking-requests/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(400);

      const body = res.body as ErrorResponseBody;
      const message = Array.isArray(body.message)
        ? body.message.join(' ')
        : body.message;
      expect(message).toContain('TO_QUALIFY');
    });

    it('refuse TO_QUALIFY -> CLOSED (saute plusieurs étapes)', async () => {
      const id = await createManualRequest();
      await trackReference(id);
      await request(app.getHttpServer())
        .patch(`/admin/booking-requests/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'TO_QUALIFY' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/admin/booking-requests/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CLOSED' })
        .expect(400);
    });

    it('refuse une transition depuis CANCELLED (statut terminal, liste vide)', async () => {
      const id = await createManualRequest();
      await trackReference(id);
      await request(app.getHttpServer())
        .patch(`/admin/booking-requests/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELLED' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/admin/booking-requests/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'TO_QUALIFY' })
        .expect(400);
    });
  });

  describe('§1 — statuts terminaux et réouverture', () => {
    it('un ADMIN ne peut pas quitter CANCELLED ; un SUPER_ADMIN peut rouvrir, action journalisée', async () => {
      const id = await createManualRequest();
      await trackReference(id);
      await request(app.getHttpServer())
        .patch(`/admin/booking-requests/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELLED' })
        .expect(200);

      // ADMIN : refusé, même avec l'endpoint dédié à la réouverture (403 —
      // rôle insuffisant, pas 400).
      await request(app.getHttpServer())
        .patch(`/admin/booking-requests/${id}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ targetStatus: 'TO_QUALIFY' })
        .expect(403);

      // SUPER_ADMIN : autorisé.
      const res = await request(app.getHttpServer())
        .patch(`/admin/booking-requests/${id}/reopen`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ targetStatus: 'TO_QUALIFY', comment: 'Client relance' })
        .expect(200);
      expect((res.body as BookingRequestDetailBody).status).toBe('TO_QUALIFY');

      const history = await request(app.getHttpServer())
        .get(`/admin/booking-requests/${id}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const actions = (history.body as { action: string }[]).map(
        (h) => h.action,
      );
      expect(actions).toContain('booking_request.reopened');
    });
  });

  describe('§2.3 — notes internes en ajout seul', () => {
    it('deux notes ajoutées successivement coexistent (pas d’écrasement)', async () => {
      const id = await createManualRequest();
      await trackReference(id);

      await request(app.getHttpServer())
        .post(`/admin/booking-requests/${id}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Première note' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/admin/booking-requests/${id}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Deuxième note' })
        .expect(201);

      const detail = await request(app.getHttpServer())
        .get(`/admin/booking-requests/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const notes = (detail.body as BookingRequestDetailBody).notes;
      expect(notes.map((n) => n.body)).toEqual(
        expect.arrayContaining(['Première note', 'Deuxième note']),
      );
      expect(notes.length).toBeGreaterThanOrEqual(2);
    });

    it('une note interne n’apparaît dans AUCUNE réponse hors périmètre admin (SPEAKER refusé)', async () => {
      const id = await createManualRequest();
      await trackReference(id);
      await request(app.getHttpServer())
        .post(`/admin/booking-requests/${id}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Note confidentielle' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/admin/booking-requests/${id}`)
        .set('Authorization', `Bearer ${speakerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/admin/booking-requests/${id}/notes`)
        .set('Authorization', `Bearer ${speakerToken}`)
        .send({ body: 'Tentative' })
        .expect(403);
    });
  });

  describe('§2.4 — pièces jointes', () => {
    it("n'est accessible ni au public ni à un rôle SPEAKER ; supprimée, plus téléchargeable même avec un lien signé valide", async () => {
      const id = await createManualRequest();
      await trackReference(id);

      const validPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
        'utf-8',
      );

      // SPEAKER refusé à l'upload.
      await request(app.getHttpServer())
        .post(`/admin/booking-requests/${id}/attachments`)
        .set('Authorization', `Bearer ${speakerToken}`)
        .field('noop', '1')
        .attach('file', validPdf, 'piece.pdf')
        .expect(403);

      const upload = await request(app.getHttpServer())
        .post(`/admin/booking-requests/${id}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', validPdf, 'piece.pdf')
        .expect(201);
      const attachmentId = (upload.body as AttachmentBody).id;

      // SPEAKER refusé sur la liste et le lien de téléchargement.
      await request(app.getHttpServer())
        .get(`/admin/booking-requests/${id}/attachments`)
        .set('Authorization', `Bearer ${speakerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get(
          `/admin/booking-requests/${id}/attachments/${attachmentId}/download-link`,
        )
        .set('Authorization', `Bearer ${speakerToken}`)
        .expect(403);

      const linkRes = await request(app.getHttpServer())
        .get(
          `/admin/booking-requests/${id}/attachments/${attachmentId}/download-link`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const { url } = linkRes.body as DownloadLinkBody;
      const path = url.replace(/^https?:\/\/[^/]+/, '');

      // Le endpoint de téléchargement lui-même est @Public() (le token
      // prouve l'autorisation), mais personne ne peut y accéder SANS ce
      // token émis par un admin — pas de test 401/403 direct pertinent ici
      // au-delà de "sans token, le lien est le seul chemin". On vérifie
      // plutôt qu'aucune route statique ne sert le fichier :
      await request(app.getHttpServer())
        .get('/uploads/booking-request-attachments/piece.pdf')
        .expect(404);

      // Téléchargement effectif avec le lien signé : OK.
      const download = await request(app.getHttpServer()).get(path).expect(200);
      expect(download.headers['content-type']).toBe('application/pdf');

      // Suppression puis réutilisation du MÊME lien encore valide : 404, pas
      // 410 (le lien n'a pas expiré, la ressource a disparu — consolidation
      // Phase 2, Partie B, réutilisée ici).
      await request(app.getHttpServer())
        .delete(`/admin/booking-requests/${id}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const afterDelete = await request(app.getHttpServer())
        .get(path)
        .expect(404);
      expect((afterDelete.body as ErrorResponseBody).statusCode).toBe(404);
    });
  });

  describe('§2.5 — isOverdue', () => {
    it('passe à true après dépassement de responseDueAt sans première réponse, redevient false une fois répondu', async () => {
      const id = await createManualRequest();
      await trackReference(id);

      // Temps simulé (pas d'attente réelle) : on pousse responseDueAt dans
      // le passé directement en base, même principe que le test de lien
      // expiré de la Phase 2c.
      await prisma.bookingRequest.update({
        where: { id },
        data: { responseDueAt: new Date(Date.now() - 60_000) },
      });

      const overdueCheck = await request(app.getHttpServer())
        .get(`/admin/booking-requests/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((overdueCheck.body as BookingRequestDetailBody).isOverdue).toBe(
        true,
      );

      // Première transition hors NEW -> firstRespondedAt renseigné ->
      // isOverdue redevient false malgré responseDueAt toujours dépassé.
      await request(app.getHttpServer())
        .patch(`/admin/booking-requests/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'TO_QUALIFY' })
        .expect(200);

      const respondedCheck = await request(app.getHttpServer())
        .get(`/admin/booking-requests/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = respondedCheck.body as BookingRequestDetailBody;
      expect(body.firstRespondedAt).not.toBeNull();
      expect(body.isOverdue).toBe(false);
    });
  });

  describe('§3 — consentement, transition douce', () => {
    it('une demande publique sans consentGivenAt/consentVersion est acceptée', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send({
          serviceType: ServiceType.CONFERENCE,
          fullName: 'No Consent Field',
          organization: 'Acme Corp',
          workEmail: `noconsent-${suffix}@example.com`,
          eventName: 'Event',
          eventDate: '2027-06-01',
          eventLocation: 'Dakar',
          eventFormat: 'In-Person',
          audienceSize: '50-100',
          primaryTopics: 'Sujet',
          goals: 'But',
          gdprConsent: true,
        })
        .expect(201);
      createdBookingReferences.push((res.body as AckResponseBody).reference);

      const row = await prisma.bookingRequest.findUniqueOrThrow({
        where: { reference: (res.body as AckResponseBody).reference },
      });
      expect(row.consentGivenAt).toBeNull();
    });
  });

  describe('§A3 (3a) — non-régression du rattachement CRM', () => {
    it('une demande publique reste rattachée automatiquement à un contact connu', async () => {
      const email = `workflow-known-${suffix}@example.com`;
      const contact = await request(app.getHttpServer())
        .post('/admin/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Workflow', lastName: 'Contact', email })
        .expect(201);
      createdContactIds.push((contact.body as ContactBody).id);

      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send({
          serviceType: ServiceType.CONFERENCE,
          fullName: 'Workflow Contact',
          organization: 'Acme Corp',
          workEmail: email,
          eventName: 'Event',
          eventDate: '2027-06-01',
          eventLocation: 'Dakar',
          eventFormat: 'In-Person',
          audienceSize: '50-100',
          primaryTopics: 'Sujet',
          goals: 'But',
          gdprConsent: true,
        })
        .expect(201);
      createdBookingReferences.push((res.body as AckResponseBody).reference);

      const row = await prisma.bookingRequest.findUniqueOrThrow({
        where: { reference: (res.body as AckResponseBody).reference },
      });
      expect(row.contactId).toBe((contact.body as ContactBody).id);
    });
  });
});
