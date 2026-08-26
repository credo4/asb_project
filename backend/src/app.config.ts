import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { PublicModule } from './modules/public/public.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

// Extrait pour être réutilisé par scripts/export-openapi.ts (export statique
// pour hébergement externe) SANS dupliquer le titre/description/scope —
// un seul endroit à mettre à jour si la doc évolue.
export function buildPublicApiDocument(app: INestApplication): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Africa Speakers Bureau — API publique')
    .setDescription(
      "Endpoints consommés par le site public (sans authentification). Voir CLAUDE.md pour l'invariant public/privé.",
    )
    .setVersion('1.0')
    .addServer(process.env.APP_URL ?? 'http://localhost:3000')
    .build();
  return SwaggerModule.createDocument(app, swaggerConfig, {
    include: [PublicModule],
  });
}

// Doc OpenAPI INTERNE, distincte de buildPublicApiDocument() ci-dessus : le
// back-office (dépôt séparé, développé par l'équipe ASB) a besoin des types
// des routes /admin/*, /auth/* et /speaker/* pour son codegen
// (openapi-typescript), mais /docs reste scopé au SEUL PublicModule — c'est
// le contrat documenté avec le développeur du site public, on ne veut pas y
// mélanger la forme des routes internes (voir commentaire sur
// SwaggerModule.setup('docs', ...) plus bas). Document COMPLET (aucun
// `include`), monté sur un chemin séparé et JAMAIS en production (voir
// configureApp) : personne d'anonyme sur le site public n'a de raison de
// tomber dessus, et la restriction NODE_ENV empêche qu'il finisse par
// accident derrière une URL publique en prod.
function buildInternalApiDocument(app: INestApplication): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Africa Speakers Bureau — API interne')
    .setDescription(
      'Ensemble des routes (admin/auth/speaker/public) — pour le codegen du back-office. Jamais monté en production.',
    )
    .setVersion('1.0')
    .addServer(process.env.APP_URL ?? 'http://localhost:3000')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, swaggerConfig);
}

// Config d'app partagée entre main.ts (bootstrap réel) et les tests e2e —
// pour que les tests s'exécutent dans les mêmes conditions que la prod
// (mêmes pipes/filtres/CORS/doc Swagger) sans dupliquer cette logique et
// risquer qu'elle diverge silencieusement entre les deux.
export function configureApp(app: INestApplication): void {
  // Derrière un reverse proxy (nginx sur le VPS), Express voit l'IP du
  // proxy sur CHAQUE requête, pas celle du vrai client — le throttler
  // (rate-limit par IP) traiterait alors tout le trafic comme venant d'une
  // seule IP. `trust proxy` lui dit de lire l'IP réelle dans le header
  // X-Forwarded-For envoyé par le proxy. À activer UNIQUEMENT si l'app est
  // effectivement derrière un proxy de confiance (sinon un client pourrait
  // usurper son IP via ce header et contourner le rate-limit).
  if (process.env.TRUST_PROXY === 'true') {
    const expressInstance = app.getHttpAdapter().getInstance() as Express;
    expressInstance.set('trust proxy', 1);
  }

  app.use(helmet());

  // Consolidation, Partie D1 — Helmet pose `Cross-Origin-Resource-Policy:
  // same-origin` par défaut (ci-dessus). Sans exception, le NAVIGATEUR du
  // site public (hébergé sur un autre domaine) bloquerait le chargement des
  // photos de speakers servies depuis /uploads dans une balise <img> — un
  // CORP restrictif s'applique même sans CORS, à la simple LECTURE d'une
  // ressource cross-origin. Relâché à `cross-origin` UNIQUEMENT pour ce
  // préfixe de route (le middleware ci-dessous s'exécute APRÈS le helmet()
  // général ci-dessus et ne réécrit QUE cet en-tête, pour les seules
  // requêtes sous /uploads) — jamais globalement : le reste de l'app garde
  // la protection par défaut de Helmet.
  app.use(
    '/uploads',
    helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
  );

  // CORS en allow-list, combinant trois sources : FRONTEND_URL (back-office /
  // espace speaker, avec credentials pour les cookies/sessions),
  // PUBLIC_SITE_ORIGINS (le site public, liste séparée par des virgules —
  // plusieurs environnements possibles : staging, prod...), et APP_URL
  // (l'origine de l'app elle-même : la doc Swagger servie sur /docs appelle
  // sa propre API en "Try it out" depuis CE domaine — sans ça, toute requête
  // POST/PATCH lancée depuis Swagger serait refusée). Jamais de wildcard :
  // une origine absente de la liste est rejetée par le navigateur.
  const allowedOrigins = [
    ...parseOrigins(process.env.FRONTEND_URL),
    ...parseOrigins(process.env.PUBLIC_SITE_ORIGINS),
    ...parseOrigins(process.env.APP_URL),
  ];

  // Consolidation, Partie D2 — `Vary: Origin` DOIT être présent sur TOUTE
  // réponse dont le contenu (les en-têtes Access-Control-Allow-*, en
  // pratique) dépend de l'Origin de la requête — sinon un cache intermédiaire
  // (le CDN Hostinger placé devant l'app, visible via l'en-tête
  // x-hcdn-cache-status) pourrait mettre en cache la réponse obtenue pour
  // UNE origine et la resservir telle quelle à une AUTRE origine. Le paquet
  // `cors` (utilisé par `app.enableCors` ci-dessous) ajoute bien ce Vary
  // quand l'origine est AUTORISÉE, mais PAS quand elle est REJETÉE (vérifié
  // empiriquement) — un trou : la réponse "sans en-têtes CORS" (cas rejeté)
  // pourrait alors être mise en cache et resservie à une origine qui, elle,
  // aurait dû être autorisée. Middleware dédié, posé AVANT `enableCors`,
  // qui garantit l'en-tête dans les DEUX cas — `res.setHeader` avant que
  // `cors` n'intervienne (qui fusionne plutôt que dupliquer s'il l'ajoute
  // aussi lui-même pour le cas autorisé, via le paquet `vary`).
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Vary', 'Origin');
    next();
  });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // `origin` est undefined pour les requêtes serveur-à-serveur (pas de
      // navigateur impliqué, donc pas de politique CORS à appliquer).
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // `callback(null, false)`, PAS `callback(new Error(...))` : une origine
      // refusée ne doit jamais faire planter la requête (500). Le paquet
      // `cors` omet alors juste les en-têtes Access-Control-Allow-*, et c'est
      // le NAVIGATEUR qui bloque la lecture de la réponse côté client — un
      // comportement CORS standard, pas une erreur serveur.
      callback(null, false);
    },
    credentials: true,
  });

  // ValidationPipe global : chaque DTO d'entrée est validé automatiquement.
  // - whitelist: supprime les propriétés non déclarées dans le DTO.
  // - forbidNonWhitelisted: rejette la requête si une propriété inconnue est
  //   envoyée (plutôt que de la supprimer silencieusement).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Doc Swagger scopée au seul PublicModule : c'est le contrat avec le
  // développeur du site public, pas une doc interne des routes admin — on
  // ne veut pas lui exposer la forme des endpoints /admin/* ou /auth/*.
  SwaggerModule.setup('docs', app, buildPublicApiDocument(app));

  // Doc interne (admin/auth/speaker), chemin séparé, hors production —
  // voir buildInternalApiDocument() ci-dessus pour le raisonnement complet.
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('internal-docs', app, buildInternalApiDocument(app));
  }
}
