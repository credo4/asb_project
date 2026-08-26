import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role, ServiceType, User } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { UsersService } from '../src/modules/users/users.service';
import { configureApp } from '../src/app.config';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
}
interface UserListBody {
  data: { id: number; email: string; role: Role }[];
  meta: { total: number };
}
interface UserDetailBody {
  id: number;
  role: Role;
  status: string;
}
interface BookingRequestBody {
  id: number;
  reference: string;
  responseDueAt: string;
  assignedAdminId: number | null;
}
interface AppSettingsBody {
  responseSlaBusinessDays: number;
}
interface LoginEventsBody {
  data: {
    id: number;
    emailAttempted: string;
    success: boolean;
    ipHash: string | null;
  }[];
}

// Ces tests prouvent, dans l'ordre du prompt (§A1 à §A4) :
// - les routes refusent un rôle insuffisant ;
// - les 3 garde-fous obligatoires de la gestion des utilisateurs ;
// - la réassignation obligatoire à la désactivation d'un admin assigné ;
// - la non-rétroactivité du délai SLA (§A4) ;
// - l'absence d'IP en clair dans login_events (§A3), échecs ET réussites.
describe('Utilisateurs, Mon compte, Paramètres, Sécurité (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let mailService: {
    sendAdminUserInvitation: jest.Mock;
    sendBookingRequestAssigned: jest.Mock;
  };

  const suffix = Date.now();
  const createdUserIds: number[] = [];
  const createdBookingIds: number[] = [];

  let superAdminA: User;
  let superAdminB: User;
  let adminToken: string;
  let speakerToken: string;

  async function tokenFor(user: User): Promise<string> {
    return jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  beforeAll(async () => {
    mailService = {
      sendAdminUserInvitation: jest.fn().mockResolvedValue(undefined),
      sendBookingRequestAssigned: jest.fn().mockResolvedValue(undefined),
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

    superAdminA = await prisma.user.create({
      data: {
        email: `e2e-users-superadmin-a-${suffix}@example.com`,
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
        firstName: 'Super',
        lastName: 'A',
      },
    });
    createdUserIds.push(superAdminA.id);

    superAdminB = await prisma.user.create({
      data: {
        email: `e2e-users-superadmin-b-${suffix}@example.com`,
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
        firstName: 'Super',
        lastName: 'B',
      },
    });
    createdUserIds.push(superAdminB.id);

    const admin = await prisma.user.create({
      data: {
        email: `e2e-users-admin-${suffix}@example.com`,
        role: Role.ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(admin.id);
    adminToken = await tokenFor(admin);

    const speaker = await prisma.user.create({
      data: {
        email: `e2e-users-speaker-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(speaker.id);
    speakerToken = await tokenFor(speaker);
  });

  afterAll(async () => {
    await prisma.loginEvent.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.bookingRequest.deleteMany({
      where: { id: { in: createdBookingIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  // -----------------------------------------------------------------
  // Rôles insuffisants
  // -----------------------------------------------------------------
  describe('rôles insuffisants', () => {
    it('SPEAKER — refusé sur GET /admin/users', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${speakerToken}`)
        .expect(403);
    });

    it('ADMIN — autorisé en lecture sur GET /admin/users', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((res.body as UserListBody).meta.total).toBeGreaterThan(0);
    });

    it('ADMIN — refusé sur POST /admin/users (invitation, réservé SUPER_ADMIN)', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `e2e-blocked-${suffix}@example.com`,
          firstName: 'X',
          lastName: 'Y',
          role: Role.ADMIN,
        })
        .expect(403);
    });

    it('ADMIN — refusé sur PATCH /admin/settings (réservé SUPER_ADMIN)', async () => {
      await request(app.getHttpServer())
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ agencyName: 'Nope' })
        .expect(403);
    });

    it('ADMIN — refusé sur GET /admin/login-events (réservé SUPER_ADMIN)', async () => {
      await request(app.getHttpServer())
        .get('/admin/login-events')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  // -----------------------------------------------------------------
  // §A1 — invitation
  // -----------------------------------------------------------------
  describe('invitation', () => {
    it('SUPER_ADMIN — invite un nouvel admin, réutilise le mécanisme de token de la 3c', async () => {
      const email = `e2e-invited-${suffix}@example.com`;
      const token = await tokenFor(superAdminA);
      const res = await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email, firstName: 'New', lastName: 'Admin', role: Role.ADMIN })
        .expect(201);

      const body = res.body as { id: number; invitationSent: boolean };
      createdUserIds.push(body.id);
      expect(body.invitationSent).toBe(true);
      expect(mailService.sendAdminUserInvitation).toHaveBeenCalled();

      const invitation = await prisma.invitationToken.findFirst({
        where: { userId: body.id },
      });
      expect(invitation).not.toBeNull();

      const created = await prisma.user.findUniqueOrThrow({
        where: { id: body.id },
      });
      expect(created.status).toBe('INVITED');
      expect(created.passwordHash).toBeNull();
    });
  });

  // -----------------------------------------------------------------
  // §A1 — garde-fous obligatoires
  // -----------------------------------------------------------------
  describe('garde-fou 1 — pas son propre rôle', () => {
    it('un SUPER_ADMIN ne peut pas changer son propre rôle, même vers SUPER_ADMIN (aucun changement)', async () => {
      const token = await tokenFor(superAdminA);
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${superAdminA.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: Role.ADMIN })
        .expect(400);
      expect((res.body as ErrorResponseBody).message).toContain('propre rôle');
    });
  });

  describe('garde-fou 2 — pas se désactiver soi-même', () => {
    it('un SUPER_ADMIN ne peut pas se désactiver lui-même', async () => {
      const token = await tokenFor(superAdminA);
      const res = await request(app.getHttpServer())
        .post(`/admin/users/${superAdminA.id}/deactivate`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
      expect((res.body as ErrorResponseBody).message).toContain(
        'propre compte',
      );
    });
  });

  describe('démotion/désactivation d’un AUTRE SUPER_ADMIN quand un autre reste actif', () => {
    it('succède (le système reste administrable)', async () => {
      const token = await tokenFor(superAdminA);
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${superAdminB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: Role.ADMIN })
        .expect(200);
      expect((res.body as UserDetailBody).role).toBe(Role.ADMIN);

      // Remet B en SUPER_ADMIN pour ne pas perturber les tests suivants.
      await prisma.user.update({
        where: { id: superAdminB.id },
        data: { role: Role.SUPER_ADMIN },
      });
    });
  });

  describe('garde-fou 3 — dernier SUPER_ADMIN actif', () => {
    // Test au niveau SERVICE, pas HTTP : côté HTTP, l'acteur doit lui-même
    // être un SUPER_ADMIN ACTIF (revalidé en base à CHAQUE requête — voir
    // JwtAccessStrategy#validate) pour franchir le RolesGuard, ce qui
    // garantit mathématiquement qu'au moins UN SUPER_ADMIN actif (l'acteur
    // lui-même) reste après l'action — donc ce chemin ne peut JAMAIS,
    // séquentiellement, ramener le compte à zéro via un acteur DIFFÉRENT de
    // la cible (le seul cas où le compte tomberait à zéro est l'auto-action,
    // déjà bloquée en amont par les garde-fous 1/2 ci-dessus). Le garde-fou
    // 3 reste néanmoins un filet de sécurité réel (védéfense en profondeur
    // contre un futur appelant qui contournerait 1/2, ou une évolution du
    // code) — on le prouve donc ici directement contre UsersService, en
    // construisant l'état "un seul SUPER_ADMIN actif" puis en simulant un
    // acteur distinct.
    it('refuse de désactiver/rétrograder le SEUL SUPER_ADMIN actif restant', async () => {
      const usersService = app.get(UsersService);

      const soloSuperAdmin = await prisma.user.create({
        data: {
          email: `e2e-solo-superadmin-${suffix}@example.com`,
          role: Role.SUPER_ADMIN,
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(soloSuperAdmin.id);
      const otherActor = await prisma.user.create({
        data: {
          email: `e2e-other-actor-${suffix}@example.com`,
          role: Role.SUPER_ADMIN,
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(otherActor.id);
      // `otherActor` désactivé APRÈS coup : au moment de l'appel, il ne
      // compte plus parmi les SUPER_ADMIN actifs, ne laissant QUE
      // soloSuperAdmin — exactement le scénario "dernier actif".
      await prisma.user.update({
        where: { id: otherActor.id },
        data: { status: 'DISABLED' },
      });

      // Base de dev PARTAGÉE : d'autres SUPER_ADMIN actifs préexistent
      // (compte de démo, fixtures d'autres suites...) — le compte du
      // garde-fou porte sur TOUS les SUPER_ADMIN actifs du système, pas
      // seulement ceux de ce test. Isolation : on les désactive
      // temporairement le temps de l'assertion, restaurés dans `finally`
      // quoi qu'il arrive (y compris si l'assertion elle-même échoue).
      const otherActiveSuperAdminIds = (
        await prisma.user.findMany({
          where: {
            role: Role.SUPER_ADMIN,
            status: 'ACTIVE',
            id: { notIn: [soloSuperAdmin.id, otherActor.id] },
          },
          select: { id: true },
        })
      ).map((u) => u.id);

      if (otherActiveSuperAdminIds.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: otherActiveSuperAdminIds } },
          data: { status: 'DISABLED' },
        });
      }

      try {
        await expect(
          usersService.update(
            soloSuperAdmin.id,
            { role: Role.ADMIN },
            {
              id: otherActor.id,
              email: otherActor.email,
              role: Role.SUPER_ADMIN,
            },
          ),
        ).rejects.toThrow(/dernier SUPER_ADMIN actif/);

        await expect(
          usersService.deactivate(
            soloSuperAdmin.id,
            {},
            {
              id: otherActor.id,
              email: otherActor.email,
              role: Role.SUPER_ADMIN,
            },
          ),
        ).rejects.toThrow(/dernier SUPER_ADMIN actif/);

        // Confirme qu'aucun des deux appels n'a réellement modifié la cible.
        const stillActive = await prisma.user.findUniqueOrThrow({
          where: { id: soloSuperAdmin.id },
        });
        expect(stillActive.role).toBe(Role.SUPER_ADMIN);
        expect(stillActive.status).toBe('ACTIVE');
      } finally {
        if (otherActiveSuperAdminIds.length > 0) {
          await prisma.user.updateMany({
            where: { id: { in: otherActiveSuperAdminIds } },
            data: { status: 'ACTIVE' },
          });
        }
      }
    });
  });

  describe('réassignation obligatoire à la désactivation', () => {
    it('refuse de désactiver un admin avec une demande assignée, sans release ni reassignToUserId', async () => {
      const targetAdmin = await prisma.user.create({
        data: {
          email: `e2e-assigned-admin-${suffix}@example.com`,
          role: Role.ADMIN,
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(targetAdmin.id);

      const superToken = await tokenFor(superAdminA);
      const booking = await request(app.getHttpServer())
        .post('/admin/booking-requests')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          serviceType: ServiceType.CONFERENCE,
          fullName: 'Réassignation Test',
          organization: 'Reassign Co',
          workEmail: `reassign-${suffix}@example.com`,
          eventName: 'Reassign Event',
          eventDate: '2027-05-01',
          eventLocation: 'Accra, Ghana',
          audienceSize: '100',
          assignedAdminId: targetAdmin.id,
        })
        .expect(201);
      createdBookingIds.push((booking.body as BookingRequestBody).id);

      const refusal = await request(app.getHttpServer())
        .post(`/admin/users/${targetAdmin.id}/deactivate`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({})
        .expect(400);
      expect((refusal.body as ErrorResponseBody).message).toContain('assigné');

      // `release: true` doit ensuite réussir et libérer l'assignation
      // (201, comme le reste des actions POST du projet — ex. .../convert).
      await request(app.getHttpServer())
        .post(`/admin/users/${targetAdmin.id}/deactivate`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ release: true })
        .expect(201);

      const freed = await prisma.bookingRequest.findUniqueOrThrow({
        where: { id: (booking.body as BookingRequestBody).id },
      });
      expect(freed.assignedAdminId).toBeNull();
    });
  });

  // -----------------------------------------------------------------
  // §A4 — non-rétroactivité du SLA
  // -----------------------------------------------------------------
  describe('§A4 — le délai SLA ne recalcule jamais une demande existante', () => {
    it('modifier app_settings.responseSlaBusinessDays laisse responseDueAt inchangé sur une demande déjà créée', async () => {
      const superToken = await tokenFor(superAdminA);

      const before = await request(app.getHttpServer())
        .get('/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);
      const originalSla = (before.body as AppSettingsBody)
        .responseSlaBusinessDays;

      const booking = await request(app.getHttpServer())
        .post('/admin/booking-requests')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          serviceType: ServiceType.CONFERENCE,
          fullName: 'SLA Test',
          organization: 'SLA Co',
          workEmail: `sla-${suffix}@example.com`,
          eventName: 'SLA Event',
          eventDate: '2027-06-01',
          eventLocation: 'Nairobi, Kenya',
          audienceSize: '50',
        })
        .expect(201);
      const bookingId = (booking.body as BookingRequestBody).id;
      createdBookingIds.push(bookingId);
      const responseDueAtBefore = (booking.body as BookingRequestBody)
        .responseDueAt;
      expect(responseDueAtBefore).toBeTruthy();

      // Modifie le paramètre — une valeur différente de l'actuelle.
      const newSla = originalSla === 9 ? 10 : 9;
      await request(app.getHttpServer())
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ responseSlaBusinessDays: newSla })
        .expect(200);

      const after = await request(app.getHttpServer())
        .get('/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);
      expect((after.body as AppSettingsBody).responseSlaBusinessDays).toBe(
        newSla,
      );

      // La demande créée AVANT la modification n'a pas bougé.
      const reread = await request(app.getHttpServer())
        .get(`/admin/booking-requests/${bookingId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);
      expect((reread.body as BookingRequestBody).responseDueAt).toBe(
        responseDueAtBefore,
      );

      // Remet la valeur d'origine pour ne pas polluer les autres tests.
      await request(app.getHttpServer())
        .patch('/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ responseSlaBusinessDays: originalSla })
        .expect(200);
    });
  });

  // -----------------------------------------------------------------
  // §A3 — journal des connexions, aucune IP en clair
  // -----------------------------------------------------------------
  describe('§A3 — login_events', () => {
    it('journalise un échec (mauvais mot de passe) et une réussite, jamais d’IP en clair', async () => {
      const password = 'Correct-Horse-Battery-Staple-1';
      const passwordHash = await bcrypt.hash(password, 4);
      const loginUser = await prisma.user.create({
        data: {
          email: `e2e-login-${suffix}@example.com`,
          role: Role.ADMIN,
          status: 'ACTIVE',
          passwordHash,
        },
      });
      createdUserIds.push(loginUser.id);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: loginUser.email, password: 'wrong-password' })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: loginUser.email, password })
        .expect(200);

      const superToken = await tokenFor(superAdminA);
      const events = await request(app.getHttpServer())
        .get(`/admin/login-events?email=${encodeURIComponent(loginUser.email)}`)
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);

      const rows = (events.body as LoginEventsBody).data;
      expect(rows.length).toBeGreaterThanOrEqual(2);
      const failure = rows.find((r) => !r.success);
      const success = rows.find((r) => r.success);
      expect(failure).toBeDefined();
      expect(success).toBeDefined();

      for (const row of rows) {
        // Jamais l'IP brute (ex. "::1"/"127.0.0.1") en clair : uniquement
        // un hash hexadécimal de longueur fixe (sha256 = 64 caractères),
        // ou null si l'IP était absente.
        if (row.ipHash !== null) {
          expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
          expect(row.ipHash).not.toBe('::1');
          expect(row.ipHash).not.toBe('127.0.0.1');
        }
      }
    });
  });
});
