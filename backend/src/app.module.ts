import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { MediaModule } from './modules/media/media.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { SpeakersModule } from './modules/speakers/speakers.module';
import { BookingRequestsModule } from './modules/booking-requests/booking-requests.module';
import { RosterApplicationsModule } from './modules/roster-applications/roster-applications.module';
import { SpeakerRevisionsModule } from './modules/speaker-revisions/speaker-revisions.module';
import { SpeakerMediaModule } from './modules/speaker-media/speaker-media.module';
import { SpeakerDocumentsModule } from './modules/speaker-documents/speaker-documents.module';
import { SpeakerAvailabilityModule } from './modules/speaker-availability/speaker-availability.module';
import { ClientsModule } from './modules/clients/clients.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PublicModule } from './modules/public/public.module';
import { resolveStorageRoot } from './storage/resolve-storage-root';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    // `isGlobal: true` : le ConfigService (variables .env) est injectable
    // partout sans réimporter ConfigModule dans chaque module métier.
    ConfigModule.forRoot({ isGlobal: true }),
    // Enregistré UNE FOIS ici (racine) : active la découverte des méthodes
    // @Cron() de toute l'app, quel que soit le module où elles vivent (voir
    // RemindersScheduler dans booking-requests/). Limite du "une seule
    // instance" documentée directement sur ce scheduler.
    ScheduleModule.forRoot(),
    // Rate-limit par défaut (anti-spam) ; des limites plus strictes sont
    // appliquées par route (ex: /auth/login) via @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // Sert UNIQUEMENT storage/public sous /uploads. Ce module utilise le
    // middleware Express `serve-static`, appliqué avant le routing Nest :
    // storage/private n'a ici aucune route, donc aucun moyen d'y accéder
    // par ce mécanisme (l'invariant public/privé est respecté par
    // construction, pas par un contrôle d'accès qu'on pourrait oublier).
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          rootPath: join(resolveStorageRoot(config), 'public'),
          serveRoot: '/uploads',
          serveStaticOptions: { index: false },
          // `@nestjs/serve-static` active par défaut un fallback "SPA" (sert
          // index.html pour toute route non trouvée) — sans intérêt ici (pas
          // de SPA) et qui, en cas d'échec, renvoyait le chemin disque complet
          // dans le message d'erreur. `exclude` désactive ce fallback pour
          // /uploads : un fichier manquant redevient un 404 générique propre.
          exclude: ['/uploads/{*any}'],
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    StorageModule,
    MediaModule,
    ActivityLogModule,
    SpeakersModule,
    BookingRequestsModule,
    RosterApplicationsModule,
    SpeakerRevisionsModule,
    SpeakerMediaModule,
    SpeakerDocumentsModule,
    SpeakerAvailabilityModule,
    ClientsModule,
    AnalyticsModule,
    PublicModule,
  ],
  providers: [
    // Ordre d'exécution des guards globaux : Throttler -> Jwt -> Roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Toute route exige un access token valide, sauf @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Restreint par rôle les routes portant @Roles(...) (aucun effet sinon).
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
