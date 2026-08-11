import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { AnalyticsService } from '../../analytics/analytics.service';
import { CreateAnalyticsEventDto } from '../../analytics/dto/create-analytics-event.dto';
import { fireAndForget } from '../../analytics/fire-and-forget.util';

// Seule route d'écriture publique de ce module, avec
// /public/booking-requests et /public/roster-applications (cf. CLAUDE.md
// §5) : allow-list stricte des types acceptés (voir CreateAnalyticsEventDto),
// rate-limit par IP, traité avec la même méfiance qu'un formulaire d'intake.
//
// Réponse 202 IMMÉDIATE, écriture en fire-and-forget (§B4) : ce endpoint
// existe pour capter des clics d'interface, jamais pour bloquer le visiteur
// le temps d'un aller-retour DB.
@ApiTags('Public — Analytics')
@Controller('public/analytics')
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class PublicAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Événement d\'interface que le back ne peut pas voir directement (ex. clic "Check Availability")',
  })
  create(
    @Body() dto: CreateAnalyticsEventDto,
    @Req() req: Request,
  ): { accepted: true } {
    fireAndForget(() =>
      this.analytics.record({
        type: dto.type,
        speakerId: dto.speakerId,
        payload: dto.slug ? { slug: dto.slug } : undefined,
        ip: req.ip ?? '',
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'],
      }),
    );
    return { accepted: true };
  }
}
