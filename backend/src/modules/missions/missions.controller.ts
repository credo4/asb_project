import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { MissionsService } from './missions.service';
import { QueryMissionsDto } from './dto/query-missions.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { UpdateMissionStatusDto } from './dto/update-mission-status.dto';

// §8 — liste/détail/CRUD des champs. Le détail renvoie TOUT : informations,
// checklist, documents, messages (historique activity_logs consultable via
// GET /admin/activity-logs?entityType=Mission&entityId=:id, module déjà
// existant — pas dupliqué ici).
@Controller('admin/missions')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class MissionsController {
  constructor(private readonly service: MissionsService) {}

  @Get()
  findAll(@Query() query: QueryMissionsDto) {
    return this.service.findAllForAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneForAdmin(id);
  }

  @Get(':id/history')
  getHistory(@Param('id', ParseIntPipe) id: number) {
    return this.service.getHistory(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMissionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateStatus(id, dto, user);
  }
}
