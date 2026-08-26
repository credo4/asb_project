import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { AvailabilityRequestsService } from './availability-requests.service';
import { SendAvailabilityRequestDto } from './dto/send-availability-request.dto';
import { ListAvailabilityRequestsDto } from './dto/list-availability-requests.dto';

@ApiTags('Admin — Availability requests')
@Controller('admin/availability-requests')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AvailabilityRequestsController {
  constructor(private readonly service: AvailabilityRequestsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Sollicitations envoyées pour une demande cliente donnée (statut, échéance, réponse si arrivée) — lecture seule, ajoutée pour le bloc « Speakers proposés » du back-office.',
  })
  findAll(@Query() query: ListAvailabilityRequestsDto) {
    return this.service.findForBookingRequest(query.bookingRequestId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Envoie une sollicitation de disponibilité — briefing composé par l’équipe (§3.1), copié en colonnes propres.',
  })
  send(
    @Body() dto: SendAvailabilityRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.send(dto, user);
  }
}
