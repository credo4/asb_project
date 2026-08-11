import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { AvailabilityRequestsService } from './availability-requests.service';
import { RespondAvailabilityRequestDto } from './dto/respond-availability-request.dto';

// §4 — aucune route ici n'accepte un id de SPEAKER fourni par l'appelant
// (voir resolveOwnSpeakerId, dérivé exclusivement de actor.id) — même
// principe que speaker-availability/speaker-media/speaker-documents. Les
// routes /:id acceptent un id D'OPPORTUNITÉ, toujours scopé par speakerId
// côté service : un id appartenant à un AUTRE speaker produit 404, jamais
// 403 (§4).
@Controller('speaker/me/opportunities')
@Roles(Role.SPEAKER)
export class SpeakerOpportunitiesController {
  constructor(private readonly service: AvailabilityRequestsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findOwnOpportunities(user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOwnOpportunity(user, id);
  }

  @Post(':id/respond')
  respond(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondAvailabilityRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.respondToOwnOpportunity(user, id, dto);
  }
}
