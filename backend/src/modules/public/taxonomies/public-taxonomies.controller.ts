import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PublicTaxonomiesService } from './public-taxonomies.service';
import { PublicPillarDto } from '../dto/public-pillar.dto';
import {
  PublicCountryRefDto,
  PublicFormatRefDto,
  PublicLanguageRefDto,
} from '../dto/outputs/reference.dto';

@ApiTags('Public — Taxonomies')
@Controller('public')
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class PublicTaxonomiesController {
  constructor(private readonly taxonomiesService: PublicTaxonomiesService) {}

  @Get('pillars')
  @ApiOperation({ summary: 'Les piliers publiés, avec leurs thèmes' })
  @ApiOkResponse({ type: [PublicPillarDto] })
  findPillars() {
    return this.taxonomiesService.findPillars();
  }

  @Get('formats')
  @ApiOperation({ summary: "Formats d'intervention (pour filtres)" })
  @ApiOkResponse({ type: [PublicFormatRefDto] })
  findFormats() {
    return this.taxonomiesService.findFormats();
  }

  @Get('languages')
  @ApiOperation({ summary: 'Langues (pour filtres)' })
  @ApiOkResponse({ type: [PublicLanguageRefDto] })
  findLanguages() {
    return this.taxonomiesService.findLanguages();
  }

  @Get('countries')
  @ApiOperation({
    summary: 'Pays ayant au moins un speaker publié (pour filtres)',
  })
  @ApiOkResponse({ type: [PublicCountryRefDto] })
  findCountries() {
    return this.taxonomiesService.findCountriesWithPublishedSpeakers();
  }
}
