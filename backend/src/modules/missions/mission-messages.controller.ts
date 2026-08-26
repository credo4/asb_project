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

@Controller('admin/missions/:missionId/messages')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class MissionMessagesController {
  constructor(private readonly service: MissionMessagesService) {}

  @Get()
  findAll(@Param('missionId', ParseIntPipe) missionId: number) {
    return this.service.listForAdmin(missionId);
  }

  @Post()
  create(
    @Param('missionId', ParseIntPipe) missionId: number,
    @Body() dto: CreateMissionMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createForAdmin(missionId, dto, user);
  }
}
