import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
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
}
