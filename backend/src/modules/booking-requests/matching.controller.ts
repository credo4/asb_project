import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { MatchingService } from './matching.service';
import { QueryMatchingCandidatesDto } from './dto/query-matching-candidates.dto';
import { MatchingCandidatesResponseDto } from './dto/outputs/matching-candidate.dto';

@ApiTags('Admin — Matching')
@Controller('admin/booking-requests/:id/matching-candidates')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class MatchingController {
  constructor(private readonly service: MatchingService) {}

  @Get()
  @ApiOperation({
    summary:
      'Recherche assistée de speakers candidats — critères satisfaits/non satisfaits, PAS un score (§1).',
  })
  @ApiOkResponse({ type: MatchingCandidatesResponseDto })
  findCandidates(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryMatchingCandidatesDto,
  ) {
    return this.service.findCandidates(id, query);
  }
}
