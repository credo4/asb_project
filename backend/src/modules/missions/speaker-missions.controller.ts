import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { MissionsService } from './missions.service';

// §6 — aucune route ici n'accepte un id de SPEAKER fourni par l'appelant
// (resolveOwnSpeakerId, dérivé exclusivement de actor.id) — même principe
// que speaker-availability/speaker-media/speaker-documents/opportunities
// (3d). Les routes /:id acceptent un id de MISSION, toujours scopé par
// speakerId côté service : un id appartenant à un autre speaker produit
// 404, jamais 403.
@Controller('speaker/me/missions')
@Roles(Role.SPEAKER)
export class SpeakerMissionsController {
  constructor(private readonly service: MissionsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findOwnMissions(user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOwnMission(user, id);
  }

  @Post(':id/accept')
  accept(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.acceptOwnMission(user, id);
  }

  @Post(':id/acknowledge-brief')
  acknowledgeBrief(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.acknowledgeBriefOwnMission(user, id);
  }
}
