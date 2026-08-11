import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.config';

// Consolidation, Partie D — en-têtes HTTP nécessaires pour que le site
// public (autre domaine) puisse afficher les photos de speakers, et pour
// qu'un cache intermédiaire (le CDN Hostinger, voir x-hcdn-cache-status) ne
// mélange jamais des réponses entre origines différentes.
describe('En-têtes HTTP — CORP et CORS (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('§D1 — Cross-Origin-Resource-Policy', () => {
    it('/uploads/* est relâché à "cross-origin" (sinon le site public ne peut pas afficher les photos)', async () => {
      // Le fichier n'a pas besoin d'exister : l'en-tête est posé par un
      // middleware AVANT la résolution du fichier statique, donc présent
      // même sur le 404 qui en résulte.
      const res = await request(app.getHttpServer()).get(
        '/uploads/does-not-exist.png',
      );
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it("le reste de l'app garde la politique par défaut de Helmet (same-origin) — pas de relâchement global", async () => {
      const res = await request(app.getHttpServer()).get('/public/pillars');
      expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    });
  });

  describe('§D2 — Vary: Origin (nécessaire pour un cache CDN intermédiaire)', () => {
    it('une origine AUTORISÉE reçoit Access-Control-Allow-Origin ET Vary: Origin', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/pillars')
        .set('Origin', 'http://localhost:4321'); // valeur par défaut de PUBLIC_SITE_ORIGINS en dev

      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:4321',
      );
      expect(res.headers.vary).toContain('Origin');
    });

    it(
      'une origine INCONNUE ne reçoit PAS Access-Control-Allow-Origin, mais reçoit QUAND MÊME ' +
        'Vary: Origin — sans ça, un cache intermédiaire pourrait resservir cette réponse ' +
        '"sans CORS" à une origine qui, elle, aurait dû être autorisée',
      async () => {
        const res = await request(app.getHttpServer())
          .get('/public/pillars')
          .set('Origin', 'http://origine-jamais-autorisee.example.com');

        expect(res.headers['access-control-allow-origin']).toBeUndefined();
        expect(res.headers.vary).toContain('Origin');
      },
    );

    it('une requête sans en-tête Origin (serveur-à-serveur) reçoit aussi Vary: Origin', async () => {
      const res = await request(app.getHttpServer()).get('/public/pillars');
      expect(res.headers.vary).toContain('Origin');
    });
  });
});
