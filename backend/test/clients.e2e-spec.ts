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
  fullName: string;
  workEmail: string;
  organization: string;
  linkedContact: { id: number; email: string } | null;
  linkedOrganization: { id: number; name: string } | null;
}
interface ContactBody {
  id: number;
  email: string;
}
interface OrganizationBody {
  id: number;
  name: string;
}

// Ces tests prouvent : la distinction intake immuable / fiche CRM (§A2), le
// rattachement automatique par email exact SANS création pour un inconnu
// (§A3), l'unicité de l'email portée par la base (§A4), et le cloisonnement
// des routes admin (§A5).
describe('Clients (organizations/contacts) API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let mailService: {
    sendBookingRequestTeamNotification: jest.Mock;
    sendBookingRequestAcknowledgment: jest.Mock;
  };

  const suffix = Date.now();
  const createdUserIds: number[] = [];
  const createdContactIds: number[] = [];
  const createdOrganizationIds: number[] = [];
  const createdBookingReferences: string[] = [];

  let adminToken: string;
  let speakerToken: string;

  async function signToken(user: User): Promise<string> {
    return jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  const validConference = (workEmail: string, fullName = 'Jane Client') => ({
    serviceType: ServiceType.CONFERENCE,
    fullName,
    organization: 'Acme Corp (intake)',
    workEmail,
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
    jwtService = app.get(JwtService);

    const adminUser = await prisma.user.create({
      data: {
        email: `e2e-clients-admin-${suffix}@example.com`,
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signToken(adminUser);

    const speakerUser = await prisma.user.create({
      data: {
        email: `e2e-clients-speaker-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(speakerUser.id);
    speakerToken = await signToken(speakerUser);
  });

  afterAll(async () => {
    await prisma.bookingRequest.deleteMany({
      where: { reference: { in: createdBookingReferences } },
    });
    await prisma.contact.deleteMany({
      where: { id: { in: createdContactIds } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: createdOrganizationIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('§A3 — rattachement automatique à la création', () => {
    it('une demande publique dont l’email est déjà connu est rattachée automatiquement au contact existant', async () => {
      const email = `known-${suffix}@example.com`;
      const contact = await request(app.getHttpServer())
        .post('/admin/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Known', lastName: 'Contact', email })
        .expect(201);
      const contactId = (contact.body as ContactBody).id;
      createdContactIds.push(contactId);

      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send(validConference(email))
        .expect(201);
      createdBookingReferences.push((res.body as AckResponseBody).reference);

      const detail = await request(app.getHttpServer())
        .get(
          `/admin/booking-requests/${await bookingRequestIdByReference((res.body as AckResponseBody).reference)}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = detail.body as BookingRequestDetailBody;
      expect(body.linkedContact).not.toBeNull();
      expect(body.linkedContact?.id).toBe(contactId);
    });

    it('une demande publique dont l’email est INCONNU ne crée AUCUNE fiche contact', async () => {
      const email = `unknown-${suffix}@example.com`;
      const countBefore = await prisma.contact.count({
        where: { normalizedEmail: email },
      });
      expect(countBefore).toBe(0);

      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send(validConference(email))
        .expect(201);
      createdBookingReferences.push((res.body as AckResponseBody).reference);

      const countAfter = await prisma.contact.count({
        where: { normalizedEmail: email },
      });
      expect(countAfter).toBe(0);

      const bookingRequest = await prisma.bookingRequest.findUniqueOrThrow({
        where: { reference: (res.body as AckResponseBody).reference },
      });
      expect(bookingRequest.contactId).toBeNull();
    });

    it("les champs d'intake d'origine restent inchangés après rattachement", async () => {
      const email = `intake-check-${suffix}@example.com`;
      const contact = await request(app.getHttpServer())
        .post('/admin/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Intake', lastName: 'Checker', email })
        .expect(201);
      createdContactIds.push((contact.body as ContactBody).id);

      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send(validConference(email, 'Original Full Name'))
        .expect(201);
      createdBookingReferences.push((res.body as AckResponseBody).reference);

      const bookingRequest = await prisma.bookingRequest.findUniqueOrThrow({
        where: { reference: (res.body as AckResponseBody).reference },
      });
      expect(bookingRequest.fullName).toBe('Original Full Name');
      expect(bookingRequest.workEmail).toBe(email);
      expect(bookingRequest.organization).toBe('Acme Corp (intake)');
    });
  });

  describe('§A4 — unicité de l’email contact', () => {
    it('deux contacts avec le même email sont impossibles (rejet par la base)', async () => {
      const email = `dup-${suffix}@example.com`;
      const first = await request(app.getHttpServer())
        .post('/admin/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'First', lastName: 'One', email })
        .expect(201);
      createdContactIds.push((first.body as ContactBody).id);

      const res = await request(app.getHttpServer())
        .post('/admin/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Second',
          lastName: 'Two',
          email: email.toUpperCase(),
        })
        .expect(409);
      expect((res.body as ErrorResponseBody).statusCode).toBe(409);
    });

    it('un contact soft-deleted libère son email pour une nouvelle fiche', async () => {
      const email = `freed-${suffix}@example.com`;
      const first = await request(app.getHttpServer())
        .post('/admin/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'ToDelete', lastName: 'Contact', email })
        .expect(201);
      const firstId = (first.body as ContactBody).id;
      createdContactIds.push(firstId);

      await request(app.getHttpServer())
        .delete(`/admin/contacts/${firstId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const second = await request(app.getHttpServer())
        .post('/admin/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Reborn', lastName: 'Contact', email })
        .expect(201);
      createdContactIds.push((second.body as ContactBody).id);
      expect((second.body as ContactBody).email).toBe(email);
    });
  });

  describe('§A5 — cloisonnement des routes (SPEAKER refusé)', () => {
    it('/admin/organizations refuse un token SPEAKER', async () => {
      await request(app.getHttpServer())
        .get('/admin/organizations')
        .set('Authorization', `Bearer ${speakerToken}`)
        .expect(403);
    });

    it('/admin/contacts refuse un token SPEAKER', async () => {
      await request(app.getHttpServer())
        .get('/admin/contacts')
        .set('Authorization', `Bearer ${speakerToken}`)
        .expect(403);
    });
  });

  describe('§A5 — CRUD organisations + suggest + link', () => {
    it('crée une organisation, la retrouve via /suggest par sous-chaîne', async () => {
      const name = `Suggestion Target Corp ${suffix}`;
      const created = await request(app.getHttpServer())
        .post('/admin/organizations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name })
        .expect(201);
      createdOrganizationIds.push((created.body as OrganizationBody).id);

      const suggestions = await request(app.getHttpServer())
        .get('/admin/organizations/suggest')
        .query({ name: 'Suggestion Target' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const names = (suggestions.body as OrganizationBody[]).map((o) => o.name);
      expect(names).toContain(name);
    });

    it('« convertir en fiche client » crée organisation ET contact depuis les données d’intake', async () => {
      const email = `convert-${suffix}@example.com`;
      const res = await request(app.getHttpServer())
        .post('/public/booking-requests')
        .send(validConference(email, 'Convert Me'))
        .expect(201);
      createdBookingReferences.push((res.body as AckResponseBody).reference);
      const bookingId = await bookingRequestIdByReference(
        (res.body as AckResponseBody).reference,
      );

      const linked = await request(app.getHttpServer())
        .patch(`/admin/booking-requests/${bookingId}/link`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          createContactFromIntake: true,
          createOrganizationFromIntake: true,
        })
        .expect(200);

      const body = linked.body as BookingRequestDetailBody;
      expect(body.linkedContact).not.toBeNull();
      expect(body.linkedOrganization).not.toBeNull();
      expect(body.linkedOrganization?.name).toBe('Acme Corp (intake)');
      // Intake inchangé malgré la conversion.
      expect(body.organization).toBe('Acme Corp (intake)');

      if (body.linkedContact) createdContactIds.push(body.linkedContact.id);
      if (body.linkedOrganization) {
        createdOrganizationIds.push(body.linkedOrganization.id);
      }
    });
  });

  // Helper : la réponse d'ACK publique ne renvoie que la référence, pas
  // l'id interne — on le retrouve via la DB directement pour appeler les
  // routes admin qui, elles, attendent un id.
  async function bookingRequestIdByReference(
    reference: string,
  ): Promise<number> {
    const row = await prisma.bookingRequest.findUniqueOrThrow({
      where: { reference },
      select: { id: true },
    });
    return row.id;
  }
});
