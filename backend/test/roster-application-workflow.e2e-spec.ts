import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApplicationStatus, Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { configureApp } from '../src/app.config';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
}
interface DetailBody {
  id: number;
  status: string;
  evaluations: { id: number; expertiseLevel: number }[];
  aggregatedScore: number | null;
  convertedSpeaker: { id: number; slug: string | null } | null;
  convertedUser: { id: number; email: string } | null;
}
interface ConversionResultBody {
  applicationId: number;
  user: { id: number; email: string };
  speaker: { id: number; slug: string | null; displayName: string };
  convertedAt: string;
  invitationSent?: boolean;
}
// Le filtre d'exception global normalise TOUTE réponse d'erreur à
// { statusCode, message, error } (CLAUDE.md §4) — les identifiants
// (speaker/compte déjà converti, utilisateur déjà existant) sont donc portés
// par le texte du message, jamais par une clé JSON dédiée.
interface ConflictBody {
  statusCode: number;
  message: string;
}
interface TokenPairBody {
  accessToken: string;
  refreshToken: string;
}
interface AckBody {
  reference: string;
}
interface SpeakerMeProfileBody {
  profile: { status: string; shortBio: string | null };
}
interface PublicSpeakerBody {
  slug: string;
  shortBio: string | null;
}

function extractToken(invitationUrl: string): string {
  const parsed = new URL(invitationUrl);
  const token = parsed.searchParams.get('token');
  if (!token) throw new Error(`Aucun token dans l'URL : ${invitationUrl}`);
  return token;
}

// Une seule assertion de type sur l'appel entier (plutôt qu'un enchaînement
// `.mock.calls[i][0]` non typé) : évite les accès "unsafe member access" côté
// ESLint tout en gardant l'extraction lisible.
function invitationUrlFromCall(mock: jest.Mock, callIndex: number): string {
  const call = mock.mock.calls[callIndex] as [{ invitationUrl: string }];
  return call[0].invitationUrl;
}

function fullEvaluationPayload(
  value: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    expertiseLevel: value,
    professionalCredibility: value,
    stageExperience: value,
    speakingQuality: value,
    internationalRelevance: value,
    languageProficiency: value,
    mediaQuality: value,
    pillarFit: value,
    commercialPotential: value,
    ...overrides,
  };
}

// Couvre le prompt Phase 3, étape 3c (§6) : machine à états (9 statuts),
// CONVERTED inatteignable manuellement, idempotence de la conversion portée
// par la base, refus explicite en cas d'email déjà utilisé, conversion qui
// RÉUSSIT même si l'envoi d'email échoue (§4.2 — aucun envoi d'email dans
// une transaction, la conversion elle-même n'est jamais annulée par un
// échec SMTP), cycle de vie du token d'invitation, évaluations (une par
// évaluateur, strictement internes), et le parcours complet Phases 1+2+3.
describe('Roster application workflow (Phase 3c) API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let mailService: {
    sendRosterApplicationTeamNotification: jest.Mock;
    sendRosterApplicationAcknowledgment: jest.Mock;
    sendRosterApplicationInfoRequested: jest.Mock;
    sendRosterApplicationRejected: jest.Mock;
    sendRosterApplicationInvitation: jest.Mock;
    sendSpeakerRevisionTeamNotification: jest.Mock;
    sendSpeakerRevisionApproved: jest.Mock;
    sendSpeakerRevisionChangesRequested: jest.Mock;
    sendSpeakerRevisionRejected: jest.Mock;
  };

  const suffix = Date.now();
  let refCounter = 0;

  const createdUserIds: number[] = [];
  const createdSpeakerIds: number[] = [];
  const createdApplicationIds: number[] = [];
  const createdPillarIds: number[] = [];

  let adminToken: string;
  let superAdminToken: string;
  let unrelatedSpeakerToken: string;
  let pillarId: number;

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

  function uniqueEmail(label: string): string {
    refCounter += 1;
    return `roster-${label}-${suffix}-${refCounter}@example.com`;
  }

  async function createApplication(overrides: Record<string, unknown> = {}) {
    refCounter += 1;
    const row = await prisma.rosterApplication.create({
      data: {
        reference: `APP-TEST-${suffix}-${refCounter}`,
        fullName: 'Jane Candidate',
        organization: 'Acme Institute',
        workEmail: uniqueEmail('app'),
        gdprConsent: true,
        status: ApplicationStatus.NEW,
        ...overrides,
      },
    });
    createdApplicationIds.push(row.id);
    return row;
  }

  beforeAll(async () => {
    mailService = {
      sendRosterApplicationTeamNotification: jest
        .fn()
        .mockResolvedValue(undefined),
      sendRosterApplicationAcknowledgment: jest
        .fn()
        .mockResolvedValue(undefined),
      sendRosterApplicationInfoRequested: jest
        .fn()
        .mockResolvedValue(undefined),
      sendRosterApplicationRejected: jest.fn().mockResolvedValue(undefined),
      sendRosterApplicationInvitation: jest.fn().mockResolvedValue(undefined),
      sendSpeakerRevisionTeamNotification: jest
        .fn()
        .mockResolvedValue(undefined),
      sendSpeakerRevisionApproved: jest.fn().mockResolvedValue(undefined),
      sendSpeakerRevisionChangesRequested: jest
        .fn()
        .mockResolvedValue(undefined),
      sendSpeakerRevisionRejected: jest.fn().mockResolvedValue(undefined),
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
      data: { email: uniqueEmail('admin'), role: Role.ADMIN, status: 'ACTIVE' },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signToken(adminUser);

    const superAdminUser = await prisma.user.create({
      data: {
        email: uniqueEmail('superadmin'),
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(superAdminUser.id);
    superAdminToken = await signToken(superAdminUser);

    // Compte SPEAKER préexistant, SANS rapport avec les candidatures de ce
    // fichier — sert uniquement à prouver qu'un rôle SPEAKER n'a accès à
    // AUCUNE route de ce module (évaluations comprises).
    const speakerUser = await prisma.user.create({
      data: {
        email: uniqueEmail('unrelated-speaker'),
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(speakerUser.id);
    unrelatedSpeakerToken = await signToken(speakerUser);

    const existingPillar = await prisma.pillar.findFirst();
    if (existingPillar) {
      pillarId = existingPillar.id;
    } else {
      const created = await prisma.pillar.create({
        data: { name: `Pilier E2E ${suffix}`, slug: `pilier-e2e-${suffix}` },
      });
      pillarId = created.id;
      createdPillarIds.push(created.id);
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
    for (const mock of Object.values(mailService)) {
      mock.mockResolvedValue(undefined);
    }
  });

  afterAll(async () => {
    await prisma.rosterApplication.deleteMany({
      where: { id: { in: createdApplicationIds } },
    });
    await prisma.speaker.deleteMany({
      where: { id: { in: createdSpeakerIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.pillar.deleteMany({ where: { id: { in: createdPillarIds } } });
    await app.close();
  });

  // -----------------------------------------------------------------------
  // Machine à états
  // -----------------------------------------------------------------------

  describe('Machine à états', () => {
    it('autorise le chemin nominal NEW -> UNDER_REVIEW -> APPROVED', async () => {
      const application = await createApplication();

      await request(app.getHttpServer())
        .patch(`/admin/roster-applications/${application.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApplicationStatus.UNDER_REVIEW })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/admin/roster-applications/${application.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApplicationStatus.APPROVED })
        .expect(200);

      expect((res.body as DetailBody).status).toBe('APPROVED');
    });

    it('refuse NEW -> INTERVIEW_DONE (liste les transitions possibles dans le message)', async () => {
      const application = await createApplication();

      const res = await request(app.getHttpServer())
        .patch(`/admin/roster-applications/${application.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApplicationStatus.INTERVIEW_DONE })
        .expect(400);

      const message = (res.body as ErrorResponseBody).message as string;
      expect(message).toContain('UNDER_REVIEW');
    });

    it("refuse APPROVED -> UNDER_REVIEW (APPROVED n'autorise que ARCHIVED)", async () => {
      const application = await createApplication({
        status: ApplicationStatus.APPROVED,
      });

      await request(app.getHttpServer())
        .patch(`/admin/roster-applications/${application.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApplicationStatus.UNDER_REVIEW })
        .expect(400);
    });

    it('refuse REJECTED -> UNDER_REVIEW (statut terminal, options vides)', async () => {
      const application = await createApplication({
        status: ApplicationStatus.REJECTED,
        rejectionReason: 'Pas de correspondance avec nos piliers.',
      });

      const res = await request(app.getHttpServer())
        .patch(`/admin/roster-applications/${application.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApplicationStatus.UNDER_REVIEW })
        .expect(400);

      expect((res.body as ErrorResponseBody).message).toContain('terminal');
    });

    it('CONVERTED est inatteignable par un changement de statut manuel', async () => {
      const application = await createApplication({
        status: ApplicationStatus.APPROVED,
      });

      const res = await request(app.getHttpServer())
        .patch(`/admin/roster-applications/${application.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApplicationStatus.CONVERTED })
        .expect(400);

      expect((res.body as ErrorResponseBody).message).toContain('/convert');

      const row = await prisma.rosterApplication.findUniqueOrThrow({
        where: { id: application.id },
      });
      expect(row.status).toBe('APPROVED');
    });

    it('réouverture depuis REJECTED réservée SUPER_ADMIN, journalisée', async () => {
      const application = await createApplication({
        status: ApplicationStatus.REJECTED,
        rejectionReason: 'motif',
      });

      await request(app.getHttpServer())
        .patch(`/admin/roster-applications/${application.id}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`) // pas SUPER_ADMIN
        .send({ targetStatus: ApplicationStatus.UNDER_REVIEW })
        .expect(403);

      const res = await request(app.getHttpServer())
        .patch(`/admin/roster-applications/${application.id}/reopen`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ targetStatus: ApplicationStatus.UNDER_REVIEW })
        .expect(200);
      expect((res.body as DetailBody).status).toBe('UNDER_REVIEW');

      const history = await request(app.getHttpServer())
        .get(`/admin/roster-applications/${application.id}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        (history.body as { action: string }[]).some(
          (h) => h.action === 'roster_application.reopened',
        ),
      ).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Conversion — idempotence, email déjà utilisé, rollback total
  // -----------------------------------------------------------------------

  describe('Conversion (§4)', () => {
    it('deux appels successifs à /convert : le second renvoie 409, un seul user et un seul speaker existent', async () => {
      const application = await createApplication({
        status: ApplicationStatus.APPROVED,
      });

      const first = await request(app.getHttpServer())
        .post(`/admin/roster-applications/${application.id}/convert`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      const body = first.body as ConversionResultBody;
      createdUserIds.push(body.user.id);
      createdSpeakerIds.push(body.speaker.id);

      const second = await request(app.getHttpServer())
        .post(`/admin/roster-applications/${application.id}/convert`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
      expect((second.body as ConflictBody).message).toContain(
        `#${body.speaker.id}`,
      );

      const userCount = await prisma.user.count({
        where: { email: application.workEmail },
      });
      expect(userCount).toBe(1);
      const speakerCount = await prisma.speaker.count({
        where: { userId: body.user.id },
      });
      expect(speakerCount).toBe(1);
      expect(mailService.sendRosterApplicationInvitation).toHaveBeenCalledTimes(
        1,
      );
    });

    it('refuse la conversion si un User existe déjà pour cet email (aucune écriture)', async () => {
      const email = uniqueEmail('already-user');
      const existingUser = await prisma.user.create({
        data: { email, role: Role.ADMIN, status: 'ACTIVE' },
      });
      createdUserIds.push(existingUser.id);

      const application = await createApplication({
        status: ApplicationStatus.APPROVED,
        workEmail: email,
      });

      const res = await request(app.getHttpServer())
        .post(`/admin/roster-applications/${application.id}/convert`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
      expect((res.body as ConflictBody).message).toContain(
        `#${existingUser.id}`,
      );

      const row = await prisma.rosterApplication.findUniqueOrThrow({
        where: { id: application.id },
      });
      expect(row.status).toBe('APPROVED');
      expect(row.convertedUserId).toBeNull();
      expect(
        mailService.sendRosterApplicationInvitation,
      ).not.toHaveBeenCalled();
    });

    it(
      "échec simulé de l'envoi d'email pendant la conversion : la " +
        'conversion RÉUSSIT quand même (compte + fiche + token existent), ' +
        "et l'échec est enregistré en FAILED dans email_deliveries " +
        "(§4.2 — aucun envoi d'email dans une transaction)",
      async () => {
        mailService.sendRosterApplicationInvitation.mockRejectedValueOnce(
          new Error('SMTP down'),
        );

        const application = await createApplication({
          status: ApplicationStatus.APPROVED,
        });

        const res = await request(app.getHttpServer())
          .post(`/admin/roster-applications/${application.id}/convert`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(201);
        const body = res.body as ConversionResultBody;
        expect(body.invitationSent).toBe(false);
        createdUserIds.push(body.user.id);
        createdSpeakerIds.push(body.speaker.id);

        // La conversion elle-même a bien eu lieu : compte, fiche et
        // rattachement présents en base — un échec SMTP ne l'annule plus.
        const row = await prisma.rosterApplication.findUniqueOrThrow({
          where: { id: application.id },
        });
        expect(row.status).toBe('CONVERTED');
        expect(row.convertedUserId).toBe(body.user.id);
        expect(row.convertedSpeakerId).toBe(body.speaker.id);

        const userCount = await prisma.user.count({
          where: { email: application.workEmail },
        });
        expect(userCount).toBe(1);

        // Le token d'invitation a bien été persisté (généré DANS la
        // transaction, indépendant de l'échec de l'envoi qui, lui, a lieu
        // après le commit) — l'admin peut renvoyer l'invitation.
        const tokenCount = await prisma.invitationToken.count({
          where: { userId: body.user.id },
        });
        expect(tokenCount).toBe(1);

        // MailService est intégralement mocké dans ce fichier (voir
        // beforeAll) : l'écriture réelle dans email_deliveries (via
        // MailService#sendAndLog) n'a donc PAS lieu ici — le mock
        // court-circuite toute l'implémentation. Cette partie du
        // comportement (échec RÉEL loggé en FAILED) est couverte par un
        // test dédié dans email-deliveries.e2e-spec.ts, qui n'utilise
        // aucun mock et déclenche un vrai échec SMTP.
      },
    );

    it("refuse la conversion si la candidature n'est pas APPROVED", async () => {
      const application = await createApplication({
        status: ApplicationStatus.UNDER_REVIEW,
      });

      await request(app.getHttpServer())
        .post(`/admin/roster-applications/${application.id}/convert`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // -----------------------------------------------------------------------
  // Token d'invitation
  // -----------------------------------------------------------------------

  describe("Token d'invitation (§4.4)", () => {
    it('usage unique : réutilisation refusée avec un message clair', async () => {
      const application = await createApplication({
        status: ApplicationStatus.APPROVED,
      });
      const conversion = await request(app.getHttpServer())
        .post(`/admin/roster-applications/${application.id}/convert`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      const { user, speaker } = conversion.body as ConversionResultBody;
      createdUserIds.push(user.id);
      createdSpeakerIds.push(speaker.id);

      const invitationUrl = invitationUrlFromCall(
        mailService.sendRosterApplicationInvitation,
        0,
      );
      const token = extractToken(invitationUrl);

      const accept = await request(app.getHttpServer())
        .post('/auth/accept-invitation')
        .send({ token, password: 'StrongPassw0rd!', acceptedTerms: true })
        .expect(200);
      expect((accept.body as TokenPairBody).accessToken).toBeDefined();

      const reuse = await request(app.getHttpServer())
        .post('/auth/accept-invitation')
        .send({ token, password: 'AnotherPassw0rd!', acceptedTerms: true })
        .expect(401);
      expect((reuse.body as ErrorResponseBody).message).toContain('invalide');
    });

    it('token expiré : message clair invitant à en redemander un', async () => {
      const invitedUser = await prisma.user.create({
        data: {
          email: uniqueEmail('expired-invite'),
          role: Role.SPEAKER,
          status: 'INVITED',
        },
      });
      createdUserIds.push(invitedUser.id);
      const expiredToken = `expired-${suffix}-${refCounter++}`;
      await prisma.invitationToken.create({
        data: {
          userId: invitedUser.id,
          token: expiredToken,
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/accept-invitation')
        .send({
          token: expiredToken,
          password: 'StrongPassw0rd!',
          acceptedTerms: true,
        })
        .expect(401);
      expect((res.body as ErrorResponseBody).message).toContain('expiré');
    });

    it('un renvoi invalide le token précédent', async () => {
      const application = await createApplication({
        status: ApplicationStatus.APPROVED,
      });
      const conversion = await request(app.getHttpServer())
        .post(`/admin/roster-applications/${application.id}/convert`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      const { user, speaker } = conversion.body as ConversionResultBody;
      createdUserIds.push(user.id);
      createdSpeakerIds.push(speaker.id);

      const firstUrl = invitationUrlFromCall(
        mailService.sendRosterApplicationInvitation,
        0,
      );
      const firstToken = extractToken(firstUrl);

      await request(app.getHttpServer())
        .post(`/admin/roster-applications/${application.id}/resend-invitation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const secondUrl = invitationUrlFromCall(
        mailService.sendRosterApplicationInvitation,
        1,
      );
      const secondToken = extractToken(secondUrl);
      expect(secondToken).not.toBe(firstToken);

      await request(app.getHttpServer())
        .post('/auth/accept-invitation')
        .send({
          token: firstToken,
          password: 'StrongPassw0rd!',
          acceptedTerms: true,
        })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/accept-invitation')
        .send({
          token: secondToken,
          password: 'StrongPassw0rd!',
          acceptedTerms: true,
        })
        .expect(200);
    });

    it("l'acceptation des conditions est obligatoire", async () => {
      const application = await createApplication({
        status: ApplicationStatus.APPROVED,
      });
      const conversion = await request(app.getHttpServer())
        .post(`/admin/roster-applications/${application.id}/convert`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      const { user, speaker } = conversion.body as ConversionResultBody;
      createdUserIds.push(user.id);
      createdSpeakerIds.push(speaker.id);

      const invitationUrl = invitationUrlFromCall(
        mailService.sendRosterApplicationInvitation,
        0,
      );
      const token = extractToken(invitationUrl);

      const res = await request(app.getHttpServer())
        .post('/auth/accept-invitation')
        .send({ token, password: 'StrongPassw0rd!', acceptedTerms: false })
        .expect(400);
      expect((res.body as ErrorResponseBody).statusCode).toBe(400);

      const userRow = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(userRow.passwordHash).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Évaluations — une par évaluateur, strictement internes
  // -----------------------------------------------------------------------

  describe('Évaluations (§2)', () => {
    it('deux admins évaluent la même candidature : les deux coexistent, le score agrégé est leur moyenne', async () => {
      const application = await createApplication();

      await request(app.getHttpServer())
        .put(`/admin/roster-applications/${application.id}/evaluations/me`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fullEvaluationPayload(2))
        .expect(200);

      await request(app.getHttpServer())
        .put(`/admin/roster-applications/${application.id}/evaluations/me`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(fullEvaluationPayload(4))
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/admin/roster-applications/${application.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as DetailBody;
      expect(body.evaluations).toHaveLength(2);
      expect(body.aggregatedScore).toBe(3);
    });

    it('une mise à jour par le même évaluateur remplace la sienne (pas une 3e ligne)', async () => {
      const application = await createApplication();

      await request(app.getHttpServer())
        .put(`/admin/roster-applications/${application.id}/evaluations/me`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fullEvaluationPayload(1))
        .expect(200);
      await request(app.getHttpServer())
        .put(`/admin/roster-applications/${application.id}/evaluations/me`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fullEvaluationPayload(5))
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/admin/roster-applications/${application.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as DetailBody;
      expect(body.evaluations).toHaveLength(1);
      expect(body.aggregatedScore).toBe(5);
    });

    it('une évaluation est invisible pour un rôle SPEAKER (endpoints entièrement bloqués)', async () => {
      const application = await createApplication();
      await request(app.getHttpServer())
        .put(`/admin/roster-applications/${application.id}/evaluations/me`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fullEvaluationPayload(3))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/admin/roster-applications/${application.id}`)
        .set('Authorization', `Bearer ${unrelatedSpeakerToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get(`/admin/roster-applications/${application.id}/evaluations`)
        .set('Authorization', `Bearer ${unrelatedSpeakerToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/admin/roster-applications')
        .set('Authorization', `Bearer ${unrelatedSpeakerToken}`)
        .expect(403);
    });
  });

  // -----------------------------------------------------------------------
  // §3 — Demande d'informations et refus
  // -----------------------------------------------------------------------

  describe("Demande d'informations et refus (§3)", () => {
    it('request-info : passe en INFO_REQUESTED, envoie un email, journalise', async () => {
      const application = await createApplication({
        status: ApplicationStatus.UNDER_REVIEW,
      });

      const res = await request(app.getHttpServer())
        .post(`/admin/roster-applications/${application.id}/request-info`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: 'Pouvez-vous préciser votre expérience scène ?' })
        .expect(201);
      expect((res.body as DetailBody).status).toBe('INFO_REQUESTED');
      expect(
        mailService.sendRosterApplicationInfoRequested,
      ).toHaveBeenCalledTimes(1);
    });

    it('reject : motif obligatoire, email envoyé UNIQUEMENT si sendRejectionEmail=true', async () => {
      const withoutEmail = await createApplication({
        status: ApplicationStatus.UNDER_REVIEW,
      });
      await request(app.getHttpServer())
        .post(`/admin/roster-applications/${withoutEmail.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rejectionReason: 'Profil hors périmètre.',
          sendRejectionEmail: false,
        })
        .expect(201);
      expect(mailService.sendRosterApplicationRejected).not.toHaveBeenCalled();

      const withEmail = await createApplication({
        status: ApplicationStatus.UNDER_REVIEW,
      });
      await request(app.getHttpServer())
        .post(`/admin/roster-applications/${withEmail.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rejectionReason: 'Profil hors périmètre.',
          sendRejectionEmail: true,
        })
        .expect(201);
      expect(mailService.sendRosterApplicationRejected).toHaveBeenCalledTimes(
        1,
      );
    });

    it('reject sans rejectionReason est refusé (400)', async () => {
      const application = await createApplication({
        status: ApplicationStatus.UNDER_REVIEW,
      });
      await request(app.getHttpServer())
        .post(`/admin/roster-applications/${application.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sendRejectionEmail: false })
        .expect(400);
    });
  });

  // -----------------------------------------------------------------------
  // PARCOURS COMPLET DE BOUT EN BOUT — relie les Phases 1, 2 et 3.
  // -----------------------------------------------------------------------

  it(
    'PARCOURS COMPLET : candidature -> évaluée -> approuvée -> convertie -> ' +
      'invitation -> mot de passe -> connexion -> profil DRAFT -> bio modifiée -> ' +
      'soumission -> approbation admin -> visible publiquement avec la nouvelle bio',
    async () => {
      // 1. Candidature reçue (vrai chemin d'ingestion publique).
      const email = uniqueEmail('e2e-full');
      const ack = await request(app.getHttpServer())
        .post('/public/roster-applications')
        .send({
          fullName: 'Kwame Speaker',
          organization: 'Continental Forum',
          workEmail: email,
          expertiseArea: 'Leadership',
          message: 'Je souhaite rejoindre le roster ASB.',
          gdprConsent: true,
        })
        .expect(201);
      const reference = (ack.body as AckBody).reference;
      const application = await prisma.rosterApplication.findUniqueOrThrow({
        where: { reference },
      });
      createdApplicationIds.push(application.id);

      // 2. Évaluée.
      await request(app.getHttpServer())
        .put(`/admin/roster-applications/${application.id}/evaluations/me`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fullEvaluationPayload(5, { comment: 'Excellent profil.' }))
        .expect(200);

      // 3. Approuvée.
      await request(app.getHttpServer())
        .patch(`/admin/roster-applications/${application.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApplicationStatus.UNDER_REVIEW })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/admin/roster-applications/${application.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApplicationStatus.APPROVED })
        .expect(200);

      // 4. Convertie.
      const conversion = await request(app.getHttpServer())
        .post(`/admin/roster-applications/${application.id}/convert`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      const { user, speaker } = conversion.body as ConversionResultBody;
      createdUserIds.push(user.id);
      createdSpeakerIds.push(speaker.id);
      expect(speaker.slug).not.toBeNull();

      // 5. Invitation -> mot de passe défini -> connexion.
      const invitationUrl = invitationUrlFromCall(
        mailService.sendRosterApplicationInvitation,
        0,
      );
      const token = extractToken(invitationUrl);
      const accepted = await request(app.getHttpServer())
        .post('/auth/accept-invitation')
        .send({ token, password: 'StrongPassw0rd!', acceptedTerms: true })
        .expect(200);
      const speakerAccessToken = (accepted.body as TokenPairBody).accessToken;

      // 6. La fiche DRAFT est bien la sienne.
      const profileRes = await request(app.getHttpServer())
        .get('/speaker/me/profile')
        .set('Authorization', `Bearer ${speakerAccessToken}`)
        .expect(200);
      const profileBody = profileRes.body as SpeakerMeProfileBody;
      expect(profileBody.profile.status).toBe('DRAFT');

      // 7. Modification de la bio (+ champs requis pour publier) -> soumission.
      const newBio = `Nouvelle bio E2E ${suffix}`;
      await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAccessToken}`)
        .send({
          shortBio: newBio,
          profilePhotoUrl: 'http://localhost:3000/uploads/e2e-photo.jpg',
          pillars: [{ pillarId, isPrimary: true }],
        })
        .expect(200);
      await request(app.getHttpServer())
        .post('/speaker/me/revision/submit')
        .set('Authorization', `Bearer ${speakerAccessToken}`)
        .expect(200);

      // 8. Approbation admin de la révision, puis publication (deux étapes
      //    distinctes du workflow existant — Phase 2a puis Phase 1b : une
      //    révision approuvée passe le speaker en APPROVED, jamais
      //    directement PUBLISHED/visible, voir SpeakerRevisionsService#approve).
      const revision = await prisma.speakerRevision.findFirstOrThrow({
        where: { speakerId: speaker.id },
        orderBy: { createdAt: 'desc' },
      });
      await request(app.getHttpServer())
        .post(`/admin/speaker-revisions/${revision.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/admin/speakers/${speaker.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PUBLISHED' })
        .expect(200);

      // 9. La fiche apparaît dans l'API publique avec la nouvelle bio.
      const publicRes = await request(app.getHttpServer())
        .get(`/public/speakers/${speaker.slug}`)
        .expect(200);
      expect((publicRes.body as PublicSpeakerBody).shortBio).toBe(newBio);
    },
  );
});
