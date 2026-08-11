import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { RosterApplicationsService } from '../../roster-applications/roster-applications.service';
import { CreateRosterApplicationDto } from '../../roster-applications/dto/create-roster-application.dto';
import { RosterApplicationAckDto } from '../../roster-applications/dto/outputs/roster-application-ack.dto';

// Voir PublicBookingRequestsController pour le raisonnement complet
// (contrôleur fin, délégation totale au service partagé avec l'admin).
@ApiTags('Public — Roster applications')
@Controller('public/roster-applications')
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class PublicRosterApplicationsController {
  constructor(
    private readonly rosterApplicationsService: RosterApplicationsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Candidature "Apply to Join Our Roster"' })
  @ApiCreatedResponse({ type: RosterApplicationAckDto })
  create(
    @Body() dto: CreateRosterApplicationDto,
  ): Promise<RosterApplicationAckDto> {
    return this.rosterApplicationsService.createFromPublic(dto);
  }
}
