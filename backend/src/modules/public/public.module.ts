import { Module } from '@nestjs/common';
import { BookingRequestsModule } from '../booking-requests/booking-requests.module';
import { RosterApplicationsModule } from '../roster-applications/roster-applications.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PublicSpeakersController } from './speakers/public-speakers.controller';
import { PublicSpeakersService } from './speakers/public-speakers.service';
import { PublicTaxonomiesController } from './taxonomies/public-taxonomies.controller';
import { PublicTaxonomiesService } from './taxonomies/public-taxonomies.service';
import { PublicBookingRequestsController } from './booking-requests/public-booking-requests.controller';
import { PublicRosterApplicationsController } from './roster-applications/public-roster-applications.controller';
import { PublicAnalyticsController } from './analytics/public-analytics.controller';
import { PublicCuratedListsController } from './curated-lists/public-curated-lists.controller';
import { PublicCuratedListsService } from './curated-lists/public-curated-lists.service';

@Module({
  // Les endpoints d'écriture publics délèguent aux services des modules
  // admin (BookingRequestsService/RosterApplicationsService/AnalyticsService)
  // plutôt que de dupliquer la logique métier — contrairement aux DTOs de
  // LECTURE (speakers/taxonomies/curated-lists), qui restent volontairement
  // dupliqués pour ne jamais coupler la projection publique au module admin
  // (cf. CLAUDE.md §5).
  imports: [BookingRequestsModule, RosterApplicationsModule, AnalyticsModule],
  controllers: [
    PublicSpeakersController,
    PublicTaxonomiesController,
    PublicBookingRequestsController,
    PublicRosterApplicationsController,
    PublicAnalyticsController,
    PublicCuratedListsController,
  ],
  providers: [
    PublicSpeakersService,
    PublicTaxonomiesService,
    PublicCuratedListsService,
  ],
})
export class PublicModule {}
