import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicCuratedListsService } from './public-curated-lists.service';
import { PublicCuratedListListResponseDto } from '../dto/public-curated-list-list-item.dto';
import { PublicCuratedListDetailDto } from '../dto/public-curated-list-detail.dto';
import { QueryPublicCuratedListsDto } from '../dto/query-public-curated-lists.dto';

@ApiTags('Public — Curated lists')
@Controller('public/curated-lists')
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class PublicCuratedListsController {
  constructor(private readonly service: PublicCuratedListsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listes éditoriales PUBLIÉES, triées par displayOrder',
    description:
      'Réponse paginée `{ data, meta }` — même contrat que GET /public/speakers ' +
      "(consolidation avant 3d : uniformisation suite à retour d'intégration " +
      "front, un tableau nu n'était pas cohérent avec le reste de l'API publique).",
  })
  @ApiOkResponse({ type: PublicCuratedListListResponseDto })
  findAll(@Query() query: QueryPublicCuratedListsDto) {
    return this.service.findAll(query);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Une liste éditoriale publiée, avec ses speakers publiés',
  })
  @ApiParam({ name: 'slug', example: 'top-fintech-voices' })
  @ApiOkResponse({ type: PublicCuratedListDetailDto })
  async findBySlug(
    @Param('slug') slug: string,
  ): Promise<PublicCuratedListDetailDto> {
    const { detail } = await this.service.findBySlug(slug);
    return detail;
  }
}
