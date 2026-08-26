import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

// §14 (ligne 5.13) — agrégation à la volée (voir reports.constants.ts pour
// le seuil de revue), aucune dépendance à un autre module métier : lit
// directement via PrismaService (@Global(), voir PrismaModule) les tables
// déjà écrites par speakers/booking-requests/missions/analytics/availability-requests.
@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
