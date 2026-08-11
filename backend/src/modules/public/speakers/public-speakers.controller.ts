import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AnalyticsEventType } from '@prisma/client';
import { Public } from '../../../common/decorators/public.decorator';
import { AnalyticsService } from '../../analytics/analytics.service';
import { fireAndForget } from '../../analytics/fire-and-forget.util';
import { PublicSpeakersService } from './public-speakers.service';
import { QueryPublicSpeakersDto } from '../dto/query-public-speakers.dto';
import {
  PublicSpeakerListItemDto,
  PublicSpeakerListResponseDto,
} from '../dto/public-speaker-list-item.dto';
import { PublicSpeakerDetailDto } from '../dto/public-speaker-detail.dto';

@ApiTags('Public — Speakers')
@Controller('public/speakers')
@Public()
// Rate-limit dédié : trafic public plus généreux que /auth mais toujours
// borné, pour limiter le scraping massif du répertoire.
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class PublicSpeakersController {
  constructor(
    private readonly publicSpeakersService: PublicSpeakersService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liste paginée des speakers publiés, avec filtres' })
  @ApiOkResponse({ type: PublicSpeakerListResponseDto })
  async findAll(
    @Query() query: QueryPublicSpeakersDto,
    @Req() req: Request,
  ): Promise<PublicSpeakerListResponseDto> {
    const result = await this.publicSpeakersService.findAll(query);

    // SEARCH (§B3) : filtres appliqués ET nombre de résultats dans le
    // payload — c'est ce qui permettra plus tard "filtres les plus utilisés"
    // et "recherches sans résultat" (Phase 4). Fire-and-forget (§B4) : ne
    // doit jamais ralentir ni faire échouer cette requête.
    fireAndForget(() =>
      this.analytics.record({
        type: AnalyticsEventType.SEARCH,
        payload: {
          filters: {
            q: query.q,
            pillar: query.pillar,
            theme: query.theme,
            country: query.country,
            language: query.language,
            format: query.format,
            feeTier: query.feeTier,
          },
          resultCount: result.meta.total,
        },
        ip: req.ip ?? '',
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'],
      }),
    );

    return result;
  }

  @Get('top-requested')
  @ApiOperation({ summary: 'Speakers marqués "Top Requested"' })
  @ApiOkResponse({ type: [PublicSpeakerListItemDto] })
  findTopRequested() {
    return this.publicSpeakersService.findTopRequested();
  }

  @Get(':slug')
  @ApiOperation({ summary: "Profil complet d'un speaker publié, par slug" })
  @ApiParam({ name: 'slug', example: 'jane-doe' })
  @ApiOkResponse({ type: PublicSpeakerDetailDto })
  async findBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<PublicSpeakerDetailDto> {
    // 404 avant tout enregistrement : une demande sur un slug inexistant/non
    // publié n'est pas une "vue de profil" (voir CLAUDE.md §5).
    const { speakerId, detail } =
      await this.publicSpeakersService.findBySlug(slug);

    fireAndForget(() =>
      this.analytics.record({
        type: AnalyticsEventType.PROFILE_VIEW,
        speakerId,
        ip: req.ip ?? '',
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'],
      }),
    );

    return detail;
  }
}
