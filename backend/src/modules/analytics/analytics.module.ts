import { Module } from '@nestjs/common';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AnalyticsService } from './analytics.service';

// AnalyticsService est exporté : PublicModule l'importe pour
// PublicAnalyticsController (modules/public/analytics/), les modules
// speakers/public l'importent pour les hooks PROFILE_VIEW/SEARCH — même
// convention que les autres domaines (voir modules/booking-requests/ +
// modules/public/booking-requests/).
@Module({
  controllers: [AdminAnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
