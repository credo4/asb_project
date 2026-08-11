import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
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
}

describe('Public roster applications API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mailService: {
    sendRosterApplicationTeamNotification: jest.Mock;
    sendRosterApplicationAcknowledgment: jest.Mock;
  };

  const createdReferences: string[] = [];

  const validApplication = () => ({
    fullName: 'Amina Candidate',
    organization: 'Pan-African Institute',
    workEmail: 'amina.candidate@example.com',
    expertiseArea: 'Climate policy',
    message: 'Je souhaite rejoindre le roster.',
    gdprConsent: true,
  });

  beforeAll(async () => {
    mailService = {
      sendRosterApplicationTeamNotification: jest
        .fn()
        .mockResolvedValue(undefined),
      sendRosterApplicationAcknowledgment: jest
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
  });

  afterEach(() => {
    jest.clearAllMocks();
    mailService.sendRosterApplicationTeamNotification.mockResolvedValue(
      undefined,
    );
    mailService.sendRosterApplicationAcknowledgment.mockResolvedValue(
      undefined,
    );
  });

  afterAll(async () => {
    await prisma.rosterApplication.deleteMany({
      where: { reference: { in: createdReferences } },
    });
    await app.close();
  });

  it('rejette une candidature sans fullName', async () => {
    const payload = validApplication() as Record<string, unknown>;
    delete payload.fullName;

    const res = await request(app.getHttpServer())
      .post('/public/roster-applications')
      .send(payload)
      .expect(400);

    expect((res.body as ErrorResponseBody).statusCode).toBe(400);
  });

  it('rejette gdprConsent=false', async () => {
    const res = await request(app.getHttpServer())
      .post('/public/roster-applications')
      .send({ ...validApplication(), gdprConsent: false })
      .expect(400);

    expect((res.body as ErrorResponseBody).statusCode).toBe(400);
  });

  it("honeypot rempli : renvoie un succès normal mais n'enregistre rien", async () => {
    const countBefore = await prisma.rosterApplication.count();

    const res = await request(app.getHttpServer())
      .post('/public/roster-applications')
      .send({ ...validApplication(), website2: 'https://spam.example.com' })
      .expect(201);

    expect((res.body as AckResponseBody).reference).toMatch(
      /^APP-\d{4}-\d{6}$/,
    );

    const countAfter = await prisma.rosterApplication.count();
    expect(countAfter).toBe(countBefore);
    expect(
      mailService.sendRosterApplicationAcknowledgment,
    ).not.toHaveBeenCalled();
  });

  it('crée une candidature avec une référence unique au format APP-YYYY-NNNNNN', async () => {
    const res = await request(app.getHttpServer())
      .post('/public/roster-applications')
      .send(validApplication())
      .expect(201);

    const reference = (res.body as AckResponseBody).reference;
    expect(reference).toMatch(/^APP-\d{4}-\d{6}$/);
    createdReferences.push(reference);

    const row = await prisma.rosterApplication.findUniqueOrThrow({
      where: { reference },
    });
    expect(row.status).toBe('NEW');
    expect(row.gdprConsent).toBe(true);
  });

  it("persiste la candidature même si les deux envois d'email échouent", async () => {
    mailService.sendRosterApplicationTeamNotification.mockRejectedValueOnce(
      new Error('SMTP down'),
    );
    mailService.sendRosterApplicationAcknowledgment.mockRejectedValueOnce(
      new Error('SMTP down'),
    );

    const res = await request(app.getHttpServer())
      .post('/public/roster-applications')
      .send(validApplication())
      .expect(201);

    const reference = (res.body as AckResponseBody).reference;
    createdReferences.push(reference);

    const row = await prisma.rosterApplication.findUnique({
      where: { reference },
    });
    expect(row).not.toBeNull();
  });
});
