import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  Logger,
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
  private readonly logger = new Logger(PublicAnalyticsController.name);

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
    // Consolidation, Partie C — la résolution slug -> id se fait ICI, DANS
    // le fire-and-forget : c'est une lecture DB comme le reste de
    // l'écriture, elle ne doit jamais ralentir la réponse 202 déjà partie.
    // Un slug inconnu (ou un speaker/une liste non publié·e) ne fait
    // JAMAIS échouer quoi que ce soit : l'événement est simplement ignoré,
    // et compté comme rejeté dans les logs (§C) — jamais une erreur
    // renvoyée au client, jamais un id transmis dans la requête OU la
    // réponse.
    fireAndForget(async () => {
      let speakerId: number | undefined;
      if (dto.speakerSlug) {
        const resolved = await this.analytics.resolveSpeakerIdBySlug(
          dto.speakerSlug,
        );
        if (resolved === null) {
          this.logger.warn(
            `Événement ${dto.type} rejeté : speakerSlug "${dto.speakerSlug}" inconnu ou non publié.`,
          );
          return;
        }
        speakerId = resolved;
      }

      let curatedListId: number | undefined;
      if (dto.curatedListSlug) {
        const resolved = await this.analytics.resolveCuratedListIdBySlug(
          dto.curatedListSlug,
        );
        if (resolved === null) {
          this.logger.warn(
            `Événement ${dto.type} rejeté : curatedListSlug "${dto.curatedListSlug}" inconnu ou non publié.`,
          );
          return;
        }
        curatedListId = resolved;
      }

      await this.analytics.record({
        type: dto.type,
        speakerId,
        curatedListId,
        // TOPIC_VIEW uniquement désormais (voir CreateAnalyticsEventDto) :
        // slug opaque, jamais résolu, stocké tel quel dans le payload.
        payload: dto.slug ? { slug: dto.slug } : undefined,
        ip: req.ip ?? '',
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'],
      });
    });
    return { accepted: true };
  }
}
