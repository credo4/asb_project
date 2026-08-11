import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { QueryAnalyticsEventsDto } from './dto/query-analytics-events.dto';

// UNIQUEMENT pour vérifier que les événements arrivent bien (§B6) — aucune
// agrégation, aucun tableau de bord ici : les statistiques sont la Phase 4.
@Controller('admin/analytics')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminAnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('events')
  findAll(@Query() query: QueryAnalyticsEventsDto) {
    return this.service.findAllForAdmin(query);
  }
}
