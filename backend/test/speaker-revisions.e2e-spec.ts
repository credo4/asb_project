import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role, RevisionStatus, SpeakerStatus, User } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { configureApp } from '../src/app.config';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
}
interface RevisionResponseBody {
  id: number;
  status: RevisionStatus;
}
interface PublicSpeakerBody {
  shortBio: string | null;
  professionalTitle: string | null;
}

// Couvre le §10 du prompt "mécanisme de brouillon et validation" : isolation
// public/révision, cloisonnement entre speakers, allow-list stricte,
// application effective à l'approbation, unicité du brouillon actif.
describe('Speaker revisions API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let mailService: Record<string, jest.Mock>;

  const suffix = Date.now();
  const createdUserIds: number[] = [];
  const createdSpeakerIds: number[] = [];

  let adminUser: User;
  let adminToken: string;
  let speakerAUser: User;
  let speakerAId: number;
  let speakerASlug: string;
  let speakerAToken: string;
  let speakerBUser: User;
  let speakerBToken: string;

  async function signToken(user: User): Promise<string> {
    return jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  // Speaker + user jetables, isolés du reste du fichier — évite tout couplage
  // avec l'historique laissé par les blocs précédents sur speakerA.
  async function createSpeakerAccount(
    label: string,
    overrides: Partial<{
      status: SpeakerStatus;
      isVisible: boolean;
      deletedAt: Date | null;
    }> = {},
  ): Promise<{ user: User; speakerId: number; token: string }> {
    const user = await prisma.user.create({
      data: {
        email: `e2e-${label}-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const speaker = await prisma.speaker.create({
      data: {
        userId: user.id,
        firstName: label,
        lastName: 'Fixture',
        status: overrides.status ?? SpeakerStatus.DRAFT,
        isVisible: overrides.isVisible ?? false,
        deletedAt: overrides.deletedAt ?? null,
      },
    });
    createdSpeakerIds.push(speaker.id);
    const token = await signToken(user);
    return { user, speakerId: speaker.id, token };
  }

  beforeAll(async () => {
    mailService = {
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

    adminUser = await prisma.user.create({
      data: {
        email: `e2e-admin-${suffix}@example.com`,
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(adminUser.id);
    adminToken = await signToken(adminUser);

    speakerAUser = await prisma.user.create({
      data: {
        email: `e2e-speaker-a-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(speakerAUser.id);
    speakerASlug = `e2e-speaker-a-${suffix}`;
    const setupPillar = await prisma.pillar.findFirstOrThrow({
      orderBy: { id: 'asc' },
    });
    const speakerA = await prisma.speaker.create({
      data: {
        userId: speakerAUser.id,
        firstName: 'Alice',
        lastName: 'Published',
        slug: speakerASlug,
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
        shortBio: 'Bio originale',
        professionalTitle: 'Titre original',
        // Un vrai speaker PUBLISHED satisfait déjà getMissingPublishRequirements
        // (photo + au moins un pilier) — sans ça, le nouveau garde-fou
        // §"invariants partagés" refuserait TOUTE approbation pour Alice,
        // même les tests qui ne portent pas spécifiquement là-dessus.
        profilePhotoUrl: 'https://example.com/alice.jpg',
        pillars: { create: [{ pillarId: setupPillar.id, isPrimary: true }] },
        publishedAt: new Date(),
      },
    });
    speakerAId = speakerA.id;
    createdSpeakerIds.push(speakerA.id);
    speakerAToken = await signToken(speakerAUser);

    speakerBUser = await prisma.user.create({
      data: {
        email: `e2e-speaker-b-${suffix}@example.com`,
        role: Role.SPEAKER,
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(speakerBUser.id);
    const speakerB = await prisma.speaker.create({
      data: {
        userId: speakerBUser.id,
        firstName: 'Bob',
        lastName: 'Other',
        status: SpeakerStatus.DRAFT,
        isVisible: false,
      },
    });
    createdSpeakerIds.push(speakerB.id);
    speakerBToken = await signToken(speakerBUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.speakerRevision.deleteMany({
      where: { speakerId: { in: createdSpeakerIds } },
    });
    await prisma.speaker.deleteMany({
      where: { id: { in: createdSpeakerIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('Allow-list stricte (§3)', () => {
    it('rejette un payload contenant feeTierPublic (champ interdit)', async () => {
      const res = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({ shortBio: 'Test', feeTierPublic: 'TIER_1' })
        .expect(400);
      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it('rejette un payload contenant isVisible (champ interdit)', async () => {
      const res = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({ shortBio: 'Test', isVisible: true })
        .expect(400);
      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it('rejette un payload contenant pricing (champ interdit)', async () => {
      const res = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({ shortBio: 'Test', pricing: { minFee: 1000 } })
        .expect(400);
      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it("rejette un payload contenant status: PUBLISHED — à L'ÉCRITURE, pas silencieusement ignoré à l'approbation", async () => {
      const countBefore = await prisma.speakerRevision.count({
        where: { speakerId: speakerAId },
      });

      const res = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({ shortBio: 'Test', status: 'PUBLISHED' })
        .expect(400);
      expect((res.body as ErrorResponseBody).statusCode).toBe(400);

      // Rejeté par le ValidationPipe AVANT même d'atteindre le service : rien
      // n'est écrit, il n'y a donc rien à "appliquer silencieusement" plus
      // tard à l'approbation.
      const countAfter = await prisma.speakerRevision.count({
        where: { speakerId: speakerAId },
      });
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('Cloisonnement entre speakers (§4)', () => {
    it("le brouillon de Bob n'est jamais celui d'Alice, même si Alice en a un actif", async () => {
      await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({ shortBio: 'Bio d’Alice en brouillon' })
        .expect(200);

      const bobRevision = await request(app.getHttpServer())
        .get('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerBToken}`)
        .expect(200);

      // Un retour `null` de service se traduit par un corps HTTP vide, que
      // supertest expose comme `{}` (échec silencieux de JSON.parse('')) —
      // ce test vérifie l'absence de données, pas la valeur JS `null` exacte.
      expect(Object.keys(bobRevision.body as object)).toHaveLength(0);
    });

    it("un compte SPEAKER sans profil lié (aucun Speaker.userId) reçoit 404, jamais les données d'un autre", async () => {
      const orphanUser = await prisma.user.create({
        data: {
          email: `e2e-orphan-${suffix}@example.com`,
          role: Role.SPEAKER,
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(orphanUser.id);
      const orphanToken = await signToken(orphanUser);

      const res = await request(app.getHttpServer())
        .get('/speaker/me/profile')
        .set('Authorization', `Bearer ${orphanToken}`)
        .expect(404);
      expect((res.body as ErrorResponseBody).statusCode).toBe(404);
    });
  });

  describe('Isolation public/révision (§2) et cycle complet', () => {
    let revisionId: number;

    it("une révision SUBMITTED n'affecte pas l'API publique", async () => {
      const put = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({
          shortBio: 'Nouvelle bio proposée',
          professionalTitle: 'Nouveau titre',
        })
        .expect(200);
      revisionId = (put.body as RevisionResponseBody).id;

      const submitted = await request(app.getHttpServer())
        .post('/speaker/me/revision/submit')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(200);
      expect((submitted.body as RevisionResponseBody).status).toBe('SUBMITTED');

      const publicView = await request(app.getHttpServer())
        .get(`/public/speakers/${speakerASlug}`)
        .expect(200);
      const body = publicView.body as PublicSpeakerBody;
      expect(body.shortBio).toBe('Bio originale');
      expect(body.professionalTitle).toBe('Titre original');
    });

    it("l'aperçu (preview) montre les valeurs proposées, sans toucher au live", async () => {
      const preview = await request(app.getHttpServer())
        .get('/speaker/me/revision/preview')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(200);
      const body = preview.body as PublicSpeakerBody;
      expect(body.shortBio).toBe('Nouvelle bio proposée');

      const publicView = await request(app.getHttpServer())
        .get(`/public/speakers/${speakerASlug}`)
        .expect(200);
      expect((publicView.body as PublicSpeakerBody).shortBio).toBe(
        'Bio originale',
      );
    });

    it('un speaker ne peut pas modifier une révision SUBMITTED sans la retirer (unicité du brouillon actif, §1/§10)', async () => {
      const res = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({ shortBio: 'Tentative pendant la soumission' })
        .expect(400);
      expect((res.body as ErrorResponseBody).statusCode).toBe(400);
    });

    it('GET /admin/speaker-revisions/:id renvoie la comparaison avant/après', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/speaker-revisions/${revisionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as {
        diff: {
          scalarChanges: { field: string; before: unknown; after: unknown }[];
        };
      };
      const shortBioChange = body.diff.scalarChanges.find(
        (c) => c.field === 'shortBio',
      );
      expect(shortBioChange).toBeDefined();
      expect(shortBioChange?.before).toBe('Bio originale');
      expect(shortBioChange?.after).toBe('Nouvelle bio proposée');
    });

    it("après approbation, la fiche live ET l'API publique reflètent les nouvelles valeurs", async () => {
      await request(app.getHttpServer())
        .post(`/admin/speaker-revisions/${revisionId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const liveSpeaker = await prisma.speaker.findUniqueOrThrow({
        where: { id: speakerAId },
      });
      expect(liveSpeaker.shortBio).toBe('Nouvelle bio proposée');
      expect(liveSpeaker.professionalTitle).toBe('Nouveau titre');
      // Une approbation ne publie jamais automatiquement (cf. §7) : le speaker
      // était déjà PUBLISHED/visible avant la révision, il le reste identique.
      expect(liveSpeaker.status).toBe(SpeakerStatus.PUBLISHED);
      expect(liveSpeaker.isVisible).toBe(true);

      const publicView = await request(app.getHttpServer())
        .get(`/public/speakers/${speakerASlug}`)
        .expect(200);
      const body = publicView.body as PublicSpeakerBody;
      expect(body.shortBio).toBe('Nouvelle bio proposée');
      expect(body.professionalTitle).toBe('Nouveau titre');
    });
  });

  describe('Refus / demande de correction', () => {
    it('un admin peut demander des corrections avec un commentaire obligatoire', async () => {
      await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({ shortBio: 'Deuxième proposition' })
        .expect(200);
      const submitted = await request(app.getHttpServer())
        .post('/speaker/me/revision/submit')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(200);
      const id = (submitted.body as RevisionResponseBody).id;

      const missingComment = await request(app.getHttpServer())
        .post(`/admin/speaker-revisions/${id}/request-changes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
      expect((missingComment.body as ErrorResponseBody).statusCode).toBe(400);

      const res = await request(app.getHttpServer())
        .post(`/admin/speaker-revisions/${id}/request-changes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewerComment: 'Merci de préciser votre bio.' })
        .expect(201);
      expect((res.body as RevisionResponseBody).status).toBe(
        'CHANGES_REQUESTED',
      );

      // Le speaker peut retravailler : l'édition repasse la révision en DRAFT.
      const reEdited = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({ shortBio: 'Bio corrigée' })
        .expect(200);
      expect((reEdited.body as RevisionResponseBody).status).toBe('DRAFT');
    });
  });

  describe('Effacement explicite d’un champ (valeur null vs champ absent)', () => {
    it('{ linkedinUrl: null } vide bien la colonne après approbation (pas ignoré comme "absent")', async () => {
      // Pré-condition : Alice a un linkedinUrl existant non-null en live.
      await prisma.speaker.update({
        where: { id: speakerAId },
        data: { linkedinUrl: 'https://linkedin.com/in/alice-avant' },
      });

      const put = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({ linkedinUrl: null })
        .expect(200);
      const id = (put.body as RevisionResponseBody).id;
      expect((put.body as RevisionResponseBody).status).toBe('DRAFT');

      await request(app.getHttpServer())
        .post('/speaker/me/revision/submit')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(200);

      // La comparaison avant/après doit montrer le passage à null, pas
      // l'absence du champ dans le diff.
      const detail = await request(app.getHttpServer())
        .get(`/admin/speaker-revisions/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const linkedinChange = (
        detail.body as {
          diff: {
            scalarChanges: { field: string; before: unknown; after: unknown }[];
          };
        }
      ).diff.scalarChanges.find((c) => c.field === 'linkedinUrl');
      expect(linkedinChange).toBeDefined();
      expect(linkedinChange?.before).toBe(
        'https://linkedin.com/in/alice-avant',
      );
      expect(linkedinChange?.after).toBeNull();

      await request(app.getHttpServer())
        .post(`/admin/speaker-revisions/${id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const liveSpeaker = await prisma.speaker.findUniqueOrThrow({
        where: { id: speakerAId },
      });
      expect(liveSpeaker.linkedinUrl).toBeNull();

      const publicView = await request(app.getHttpServer())
        .get(`/public/speakers/${speakerASlug}`)
        .expect(200);
      expect(
        (publicView.body as { linkedinUrl: string | null }).linkedinUrl,
      ).toBeNull();
    });
  });

  describe('Fraîcheur du diff face à une édition admin concurrente', () => {
    it('le diff admin reflète le live ACTUEL au moment de la consultation, pas un instantané figé à la soumission', async () => {
      const put = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({ professionalTitle: 'Titre proposé par le speaker' })
        .expect(200);
      const id = (put.body as RevisionResponseBody).id;
      await request(app.getHttpServer())
        .post('/speaker/me/revision/submit')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .expect(200);

      // Pendant que la révision est SUBMITTED, un admin modifie directement
      // la fiche live (simulé ici par un update direct — équivalent du CRUD
      // admin Phase 1b sur un champ que la révision ne touche pas du tout).
      await prisma.speaker.update({
        where: { id: speakerAId },
        data: { professionalTitle: 'Titre modifié entretemps par un admin' },
      });

      const detail = await request(app.getHttpServer())
        .get(`/admin/speaker-revisions/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const change = (
        detail.body as {
          diff: {
            scalarChanges: { field: string; before: unknown; after: unknown }[];
          };
        }
      ).diff.scalarChanges.find((c) => c.field === 'professionalTitle');

      // Le "before" doit être la valeur LIVE ACTUELLE (modifiée par l'admin
      // après la soumission), pas celle qui existait au moment où le speaker
      // a soumis — la preuve que le diff est recalculé à chaque consultation.
      expect(change?.before).toBe('Titre modifié entretemps par un admin');
      expect(change?.after).toBe('Titre proposé par le speaker');

      // Comportement accepté comme suffisant (pas de verrou optimiste) :
      // l'approbation applique quand même la proposition du speaker sur ce
      // champ — mais l'admin l'a VU dans un diff frais avant de cliquer.
      await request(app.getHttpServer())
        .post(`/admin/speaker-revisions/${id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      const liveSpeaker = await prisma.speaker.findUniqueOrThrow({
        where: { id: speakerAId },
      });
      expect(liveSpeaker.professionalTitle).toBe(
        'Titre proposé par le speaker',
      );
    });
  });

  describe('Unicité de la révision active — y compris sous course (§3 de la demande de vérification)', () => {
    it('la contrainte DB (activeGuard unique) rejette une 2e révision active pour le même speaker', async () => {
      const { speakerId } = await createSpeakerAccount('unique-guard-direct');

      await prisma.speakerRevision.create({
        data: {
          speakerId,
          payload: {},
          status: RevisionStatus.DRAFT,
          activeGuard: speakerId,
        },
      });

      await expect(
        prisma.speakerRevision.create({
          data: {
            speakerId,
            payload: {},
            status: RevisionStatus.DRAFT,
            activeGuard: speakerId,
          },
        }),
      ).rejects.toThrow();
    });

    it('deux PUT quasi simultanés sur le même speaker ne laissent jamais deux brouillons actifs', async () => {
      const { speakerId, token } = await createSpeakerAccount('concurrent-put');

      await Promise.allSettled([
        request(app.getHttpServer())
          .put('/speaker/me/revision')
          .set('Authorization', `Bearer ${token}`)
          .send({ shortBio: 'Version A' }),
        request(app.getHttpServer())
          .put('/speaker/me/revision')
          .set('Authorization', `Bearer ${token}`)
          .send({ shortBio: 'Version B' }),
      ]);

      const activeCount = await prisma.speakerRevision.count({
        where: {
          speakerId,
          status: {
            in: [
              RevisionStatus.DRAFT,
              RevisionStatus.SUBMITTED,
              RevisionStatus.CHANGES_REQUESTED,
            ],
          },
        },
      });
      expect(activeCount).toBe(1);
    });
  });

  describe('Cas limites (§4 de la demande de vérification)', () => {
    it('un speaker soft-deleted (deletedAt non-null) reçoit 404 partout, jamais 500', async () => {
      const { token } = await createSpeakerAccount('soft-deleted', {
        status: SpeakerStatus.ARCHIVED,
        deletedAt: new Date(),
      });

      const profileRes = await request(app.getHttpServer())
        .get('/speaker/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect((profileRes.body as ErrorResponseBody).statusCode).toBe(404);

      const putRes = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${token}`)
        .send({ shortBio: 'Tentative après suppression' })
        .expect(404);
      expect((putRes.body as ErrorResponseBody).statusCode).toBe(404);
    });

    it("le journal trace à la fois l'auteur speaker (soumission) et l'admin (approbation) — sur des lignes distinctes", async () => {
      const { user, speakerId, token } =
        await createSpeakerAccount('activity-log-trail');

      const put = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${token}`)
        .send({ shortBio: 'Traçabilité' })
        .expect(200);
      const id = (put.body as RevisionResponseBody).id;

      await request(app.getHttpServer())
        .post('/speaker/me/revision/submit')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/admin/speaker-revisions/${id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const logs = await prisma.activityLog.findMany({
        where: { entityType: 'SpeakerRevision', entityId: id },
        orderBy: { createdAt: 'asc' },
      });

      // Un seul acteur par ligne (schéma `activity_logs.actorId` = FK
      // unique) : la traçabilité "les deux acteurs" existe comme une SUITE
      // d'événements distincts sur la même entité, pas une ligne à deux
      // acteurs — reconstituable en filtrant par entityType/entityId.
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'speaker_revision.draft_created',
            actorId: user.id,
          }),
          expect.objectContaining({
            action: 'speaker_revision.submitted',
            actorId: user.id,
          }),
          expect.objectContaining({
            action: 'speaker_revision.approved',
            actorId: adminUser.id,
          }),
        ]),
      );

      // L'entrée sur l'entité Speaker elle-même (mise à jour de la fiche
      // live) est également attribuée à l'admin qui a approuvé.
      const speakerLog = await prisma.activityLog.findFirst({
        where: {
          entityType: 'Speaker',
          entityId: speakerId,
          action: 'speaker.updated_via_revision',
        },
      });
      expect(speakerLog?.actorId).toBe(adminUser.id);
    });
  });

  describe('Revue externe — whitelist imbriquée', () => {
    it('rejette un champ non déclaré à l’intérieur de pillars[] (whitelist imbriquée, pas juste au 1er niveau)', async () => {
      const pillar = await prisma.pillar.findFirstOrThrow({
        orderBy: { id: 'asc' },
      });
      const countBefore = await prisma.speakerRevision.count({
        where: { speakerId: speakerAId },
      });

      const res = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({
          pillars: [
            { pillarId: pillar.id, isPrimary: true, injectedField: 'x' },
          ],
        })
        .expect(400);
      expect((res.body as ErrorResponseBody).message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('injectedField should not exist'),
        ]),
      );

      const countAfter = await prisma.speakerRevision.count({
        where: { speakerId: speakerAId },
      });
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('Revue externe — invariants partagés entre les deux chemins d’écriture', () => {
    async function publishedSpeakerWithCompleteProfile(label: string) {
      const { user, speakerId, token } = await createSpeakerAccount(label, {
        status: SpeakerStatus.PUBLISHED,
        isVisible: true,
      });
      const pillar = await prisma.pillar.findFirstOrThrow({
        orderBy: { id: 'asc' },
      });
      await prisma.speaker.update({
        where: { id: speakerId },
        data: {
          slug: `${label}-${suffix}-${speakerId}`,
          publicName: 'Profil complet',
          shortBio: 'Bio avant',
          profilePhotoUrl: 'https://example.com/photo.jpg',
          pillars: { create: [{ pillarId: pillar.id, isPrimary: true }] },
        },
      });
      return { user, speakerId, token };
    }

    it("refuse d'approuver une révision qui viderait shortBio sur un speaker déjà PUBLISHED (au lieu de publier silencieusement une fiche incomplète)", async () => {
      const { speakerId, token } = await publishedSpeakerWithCompleteProfile(
        'publish-guard-shortbio',
      );

      const put = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${token}`)
        .send({ shortBio: null })
        .expect(200);
      const id = (put.body as RevisionResponseBody).id;
      await request(app.getHttpServer())
        .post('/speaker/me/revision/submit')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const approveRes = await request(app.getHttpServer())
        .post(`/admin/speaker-revisions/${id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      expect((approveRes.body as ErrorResponseBody).message).toContain(
        'bio courte (shortBio)',
      );

      // Rien n'a été appliqué : transaction annulée, fiche live intacte.
      const liveSpeaker = await prisma.speaker.findUniqueOrThrow({
        where: { id: speakerId },
      });
      expect(liveSpeaker.shortBio).toBe('Bio avant');
      expect(liveSpeaker.status).toBe(SpeakerStatus.PUBLISHED);

      // La révision reste SUBMITTED — l'admin doit demander des corrections,
      // pas juste réessayer d'approuver.
      const revisionRow = await prisma.speakerRevision.findUniqueOrThrow({
        where: { id },
      });
      expect(revisionRow.status).toBe(RevisionStatus.SUBMITTED);
    });

    it('refuse aussi si la révision viderait pillars (aucun pilier) sur un speaker PUBLISHED', async () => {
      const { speakerId, token } = await publishedSpeakerWithCompleteProfile(
        'publish-guard-pillars',
      );

      const put = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${token}`)
        .send({ pillars: [] })
        .expect(200);
      const id = (put.body as RevisionResponseBody).id;
      await request(app.getHttpServer())
        .post('/speaker/me/revision/submit')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const approveRes = await request(app.getHttpServer())
        .post(`/admin/speaker-revisions/${id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      expect((approveRes.body as ErrorResponseBody).message).toContain(
        'au moins un pilier',
      );

      const liveSpeaker = await prisma.speaker.findUniqueOrThrow({
        where: { id: speakerId },
      });
      expect(liveSpeaker.status).toBe(SpeakerStatus.PUBLISHED);
    });

    it("laisse passer l'approbation quand la révision garde le profil complet (le garde-fou ne bloque pas les cas valides)", async () => {
      const { speakerId, token } = await publishedSpeakerWithCompleteProfile(
        'publish-guard-valid',
      );

      const put = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${token}`)
        .send({ shortBio: 'Nouvelle bio, toujours non-vide' })
        .expect(200);
      const id = (put.body as RevisionResponseBody).id;
      await request(app.getHttpServer())
        .post('/speaker/me/revision/submit')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/admin/speaker-revisions/${id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const liveSpeaker = await prisma.speaker.findUniqueOrThrow({
        where: { id: speakerId },
      });
      expect(liveSpeaker.shortBio).toBe('Nouvelle bio, toujours non-vide');
    });

    it('rejette au brouillon (PUT) deux piliers isPrimary:true — feedback immédiat au speaker', async () => {
      const pillars = await prisma.pillar.findMany({
        orderBy: { id: 'asc' },
        take: 2,
      });
      if (pillars.length < 2) {
        throw new Error('Fixture insuffisante : au moins 2 pillars requis.');
      }

      const res = await request(app.getHttpServer())
        .put('/speaker/me/revision')
        .set('Authorization', `Bearer ${speakerAToken}`)
        .send({
          pillars: [
            { pillarId: pillars[0].id, isPrimary: true },
            { pillarId: pillars[1].id, isPrimary: true },
          ],
        })
        .expect(400);
      expect((res.body as ErrorResponseBody).message).toContain(
        'Un seul pilier peut être marqué comme principal (isPrimary).',
      );
    });

    it("rejette à l'approbation (défense en profondeur) une révision créée directement en base avec deux piliers isPrimary:true, contournant la validation du brouillon", async () => {
      const { speakerId } = await createSpeakerAccount('approve-guard-bypass');
      const pillars = await prisma.pillar.findMany({
        orderBy: { id: 'asc' },
        take: 2,
      });

      const revision = await prisma.speakerRevision.create({
        data: {
          speakerId,
          status: RevisionStatus.SUBMITTED,
          submittedAt: new Date(),
          activeGuard: speakerId,
          payload: {
            pillars: [
              { pillarId: pillars[0].id, isPrimary: true },
              { pillarId: pillars[1].id, isPrimary: true },
            ],
          },
        },
      });

      const approveRes = await request(app.getHttpServer())
        .post(`/admin/speaker-revisions/${revision.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      expect((approveRes.body as ErrorResponseBody).message).toContain(
        'Un seul pilier peut être marqué comme principal (isPrimary).',
      );
    });
  });
});
