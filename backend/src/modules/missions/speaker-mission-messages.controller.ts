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
import { MissionMessagesService } from './mission-messages.service';
import { CreateMissionMessageDto } from './dto/create-mission-message.dto';

// §6 — visible du SEUL speaker concerné. Scoping via resolveOwnSpeakerId,
// 404 sur la mission d'un autre speaker.
@Controller('speaker/me/missions/:missionId/messages')
@Roles(Role.SPEAKER)
export class SpeakerMissionMessagesController {
  constructor(private readonly service: MissionMessagesService) {}

  @Get()
  findAll(
    @Param('missionId', ParseIntPipe) missionId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listForSpeaker(user, missionId);
  }

  @Post()
  create(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Body() dto: CreateMissionMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createForSpeaker(user, missionId, dto);
  }
}
